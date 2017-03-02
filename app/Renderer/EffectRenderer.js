import { WebGLRenderer, WebGLRenderTarget, LinearFilter, RGBFormat, OrthographicCamera, Mesh, Scene, PlaneGeometry } from 'three';
import RendererStore from '../stores/RendererStore.js';
import AnimationStore from '../stores/AnimationStore.js';

export default class EffectRenderer {

  constructor(options, camera, scene) {

    const { width, height } = this.getSize();
    const RenderTarget = new WebGLRenderTarget(width, height, { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBFormat, stencilBuffer: false });
    this.renderer = new WebGLRenderer(options);
    this.resolution = window.devicePixelRatio;
    this.animationToken = 0;
    this.rTarget1 = RenderTarget;
    this.rTarget2 = RenderTarget.clone();
    this.writeBuffer = this.rTarget1;
    this.readBuffer = this.rTarget2;
    this.passes = [new RenderPass(camera, scene)];
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2,2), null);
    this.scene = new Scene();
    this.scene.add(this.quad);

    window.addEventListener('resize', this.resizeHandler.bind(this));

    RendererStore.set('resolution', this.resolution);

    this.renderer.setPixelRatio(this.resolution);

    this.setStore();

    this.resizeHandler();

  }

  get domElement() {
    return this.renderer.domElement;
  }

  addPass(shader) {
    this.passes.push(shader);
  }

  setStore() {
    const { width, height } = this.getWindowSize();
    RendererStore.set('width', width);
    RendererStore.set('height', height);
  }

  resizeHandler() {
    const { width, height } = this.getWindowSize();
    const tWidth = width * this.resolution;
    const tHeight = height * this.resolution;

    this.renderer.setSize(width, height);

    if (this.passes[0].camera) {
      this.passes[0].camera.aspect = width / height;
      this.passes[0].camera.updateProjectionMatrix();
    }

    const rT = this.rTarget1.clone();
    rT.width = tWidth;
    rT.height = tHeight;
    this.rTarget1 = rT;
    this.rTarget2 = rT;
    this.writeBuffer = this.rTarget1;
    this.writeBuffer = this.rTarget2;

    this.setStore();

    RendererStore.emitChange();
  }

  getWindowSize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return { width, height };
  }

  getSize() {
    const width = window.innerWidth * window.devicePixelRatio;
    const height = window.innerHeight * window.devicePixelRatio;

    return { width, height };
  }

  start() {
    this.active = true;
    this.animationToken = window.requestAnimationFrame(this.animate.bind(this));
  }

  stop() {
    window.cancelAnimationFrame(this.animationToken);
    this.active = false;
  }

  isRenderable() {
    return this.scene !== false && this.camera !== false;
  }

  animate() {
    if (this.active && this.isRenderable()) {
      this.render();
      AnimationStore.emitChange();
      window.requestAnimationFrame(this.animate.bind(this));
    }
  }

  render() {
    this.writeBuffer = this.rTarget1;
    this.readBuffer = this.rTarget2;

    this.passes.forEach( (pass)=>{
      pass.enabled && pass.render(this.renderer, this.writeBuffer, this.readBuffer, {
        camera: this.camera,
        scene: this.scene,
        quad: this.quad
      });
      const tmp = this.readBuffer;
      this.readBuffer = this.writeBuffer;
      this.writeBuffer = tmp;
    } );
  }

}

import { UniformsUtils, ShaderMaterial } from 'three'

export class ShaderPass {
  constructor(shader, ID = 'tDiffuse') {
    const { uniforms, vertexShader, fragmentShader } = shader;
    this.textureID = ID;
    this.uniforms = UniformsUtils.clone(uniforms);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader
    });
    this.renderToScreen = false;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
  }

  render(renderer, writeBuffer, readBuffer, RendererBits) {
    const { camera, scene, quad } = RendererBits;
    if (this.uniforms[this.textureID]) {
      this.uniforms[this.textureID].value = readBuffer.texture
    }

    quad.material = this.material;

    if (this.renderToScreen) {
      renderer.render(scene, camera);
    } else {
      renderer.render(scene, camera, writeBuffer, this.clear);
    }
  }
}

export const CopyShader = {
  uniforms: {
    'tDiffuse': { type: 't', value: null },
    'opacity': { type: 'f', value: 1.0 }
  },
  vertexShader: `varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: `uniform float opacity;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );
      gl_FragColor = opacity * texel;
    }`
}

export class RenderPass {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.clear = true;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    renderer.render(this.scene, this.camera, readBuffer, true);
  }
}

