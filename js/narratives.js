// Narratives: the extra bits A-Frame doesn't have.
// You don't need to change anything here. Build your scene in index.html.

const THREE = AFRAME.THREE;


// The dome. Bright at the bottom edge, glowing around the hole.
AFRAME.registerShader('dome', {
  schema: {
    color: { type: 'color', is: 'uniform', default: '#ff8636' },
    brightness: { type: 'number', is: 'uniform', default: 1 },
    hole: { type: 'number', is: 'uniform', default: 0.174 }
  },

  vertexShader: `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    #include <common>
    uniform vec3 color;
    uniform float brightness;
    uniform float hole;
    varying vec3 vPos;

    void main() {
      float h = clamp(vPos.y, 0.0, 1.0);   // 0 at the bottom, 1 at the top
      float r = length(vPos.xz);           // distance from the middle

      vec3 warmWhite = vec3(1.0, 0.93, 0.8);
      vec3 hot = mix(color, warmWhite, 0.62 * smoothstep(0.45, 1.0, brightness));

      vec3 c = color * (0.74 + 0.36 * exp(-h * 2.6));
      c += hot * exp(-h * 10.0) * 2.4;                                       // light strip
      c += mix(color, warmWhite, 0.5) * exp(-max(r - hole, 0.0) * 7.0) * 0.42; // glow at the hole

      gl_FragColor = vec4(c * brightness, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb += (rand(gl_FragCoord.xy) - 0.5) / 255.0; // no banding
    }
  `
});


// The sky you see through the hole. Clouds by day, stars when it's dark.
AFRAME.registerShader('open-sky', {
  schema: {
    color: { type: 'color', is: 'uniform', default: '#18a2ff' },
    clouds: { type: 'number', is: 'uniform', default: 0.3 },
    time: { type: 'time', is: 'uniform' }
  },

  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    #include <common>
    uniform vec3 color;
    uniform float clouds;
    uniform float time;
    varying vec3 vDir;

    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(rand(i), rand(i + vec2(1, 0)), u.x),
                 mix(rand(i + vec2(0, 1)), rand(i + vec2(1, 1)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 d = normalize(vDir);
      vec3 c = mix(mix(color, vec3(1.0), 0.45), color, pow(max(d.y, 0.0), 0.55));

      // stars
      float light = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float night = 1.0 - smoothstep(0.004, 0.045, light);
      vec2 sp = vec2(atan(d.z, d.x), asin(d.y)) * 160.0;
      c += step(0.985, rand(floor(sp))) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5)) * night * 1.4;

      // clouds
      vec2 p = d.xz / max(d.y, 0.06) * 1.6 + vec2(3.75, 8.25) + time * 0.00002 * vec2(1.0, 0.4);
      float n = fbm(p);
      float edge = 0.75 - 0.75 * clouds;
      float cover = smoothstep(edge, edge + 0.15, n) * min(clouds * 4.0, 1.0) * smoothstep(0.02, 0.3, d.y);
      vec3 cloud = vec3(0.97) * (0.82 + 0.3 * n) * (0.12 + 0.88 * smoothstep(0.0, 0.15, light));
      c = mix(c, cloud, cover * 0.9);

      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
});


// Wood. "boards" for walls, "rings" for the round floor.
const woodCanvas = {};

AFRAME.registerComponent('wood', {
  dependencies: ['geometry', 'material'],
  schema: {
    pattern: { default: 'boards' },
    repeat: { default: 1 }
  },

  init: function () {
    const pattern = this.data.pattern;
    if (!woodCanvas[pattern]) {
      woodCanvas[pattern] = pattern === 'rings' ? drawRings() : drawBoards();
    }

    const texture = new THREE.CanvasTexture(woodCanvas[pattern]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = this.data.repeat;
    texture.anisotropy = 8;

    const mesh = this.el.getObject3D('mesh');
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
  }
});

function woodColor() {
  const t = 0.87 + Math.random() * 0.26;
  return `rgb(${186 * t}, ${140 * t}, ${98 * t})`;
}

function grainColor() {
  return `rgba(70, 40, 18, ${0.05 + Math.random() * 0.12})`;
}

// Planks in circles, seen from above. Fits a floor 9 m across from the middle.
function drawRings() {
  const size = 2048;
  const mid = size / 2;
  const px = size / 18; // pixels per meter

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  for (let r = 0.2; r < 9.2; r += 0.165) {
    const inner = r * px;
    const outer = (r + 0.165) * px;
    let a = Math.random() * Math.PI * 2;
    const end = a + Math.PI * 2;

    while (a < end) {
      const next = Math.min(end, a + (1.2 + Math.random() * 2.4) / (r + 0.08));

      // plank
      ctx.fillStyle = woodColor();
      ctx.beginPath();
      ctx.arc(mid, mid, outer, a, next);
      ctx.arc(mid, mid, inner, next, a, true);
      ctx.fill();

      // grain
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = grainColor();
        ctx.lineWidth = 0.6 + Math.random();
        ctx.beginPath();
        ctx.arc(mid, mid, inner + Math.random() * (outer - inner), a, next);
        ctx.stroke();
      }

      // joint
      ctx.strokeStyle = 'rgba(40, 22, 10, 0.55)';
      ctx.beginPath();
      ctx.moveTo(mid + Math.cos(a) * inner, mid + Math.sin(a) * inner);
      ctx.lineTo(mid + Math.cos(a) * outer, mid + Math.sin(a) * outer);
      ctx.stroke();

      a = next;
    }

    ctx.strokeStyle = 'rgba(38, 20, 8, 0.5)';
    ctx.beginPath();
    ctx.arc(mid, mid, inner, 0, Math.PI * 2);
    ctx.stroke();
  }

  // darker where the floor meets the wall
  ctx.globalCompositeOperation = 'multiply';
  const shadow = ctx.createRadialGradient(mid, mid, 7.8 * px, mid, mid, 9 * px);
  shadow.addColorStop(0, '#ffffff');
  shadow.addColorStop(1, '#8a8480');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

// Straight boards for the walls.
function drawBoards() {
  const w = 1024;
  const h = 512;
  const count = 18;
  const bw = w / count;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < count; i++) {
    const x = i * bw;

    ctx.fillStyle = woodColor();
    ctx.fillRect(x, 0, bw + 1, h);

    for (let g = 0; g < 7; g++) {
      const gx = x + Math.random() * bw;
      ctx.strokeStyle = grainColor();
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.7, gx + 1, h);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(36, 20, 9, 0.6)';
    ctx.fillRect(x, 0, 2, h);
  }

  // darker at the top and bottom
  ctx.globalCompositeOperation = 'multiply';
  const shadow = ctx.createLinearGradient(0, 0, 0, h);
  shadow.addColorStop(0, '#8a847f');
  shadow.addColorStop(0.16, '#ffffff');
  shadow.addColorStop(0.9, '#ffffff');
  shadow.addColorStop(1, '#a29c97');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}


// Lights your models with the color of the room, and lets shiny things reflect it.
// Set live: true if you animate the dome color.
AFRAME.registerComponent('room-light', {
  schema: {
    live: { default: false }
  },

  init: function () {
    this.target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.camera = new THREE.CubeCamera(0.1, 1000, this.target);
    this.camera.position.set(0, 1.6, 0);
    this.pmrem = new THREE.PMREMGenerator(this.el.sceneEl.renderer);
    this.count = 0;
    this.last = -1000;
  },

  tick: function (time) {
    if (!this.data.live && this.count >= 3) return;
    if (time - this.last < 250) return;
    this.last = time;
    this.count++;

    // only the room goes in the picture, not your models
    const ROOM = 5;
    this.el.object3D.traverse((obj) => obj.layers.enable(ROOM));
    this.camera.children.forEach((cam) => cam.layers.set(ROOM));

    const scene = this.el.sceneEl.object3D;
    this.camera.update(this.el.sceneEl.renderer, scene);
    this.envMap = this.pmrem.fromCubemap(this.target.texture, this.envMap);
    scene.environment = this.envMap.texture;
  }
});


// look-controls ignores rotation="", so this sets where you look first (degrees).
AFRAME.registerComponent('start-view', {
  schema: {
    pitch: { default: 24 },
    yaw: { default: 0 }
  },

  tick: function () {
    const look = this.el.components['look-controls'];
    if (this.done || !look || !look.pitchObject) return;
    look.pitchObject.rotation.x = THREE.MathUtils.degToRad(this.data.pitch);
    look.yawObject.rotation.y = THREE.MathUtils.degToRad(this.data.yaw);
    this.done = true;
  }
});


// fit-model="size: 1.5" makes the longest side 1.5 m.
// Add base: true to sit it on the floor.
AFRAME.registerComponent('fit-model', {
  schema: {
    size: { default: 1.5 },
    base: { default: false }
  },

  init: function () {
    this.el.addEventListener('model-loaded', () => this.fit());
  },

  fit: function () {
    const model = this.el.getObject3D('mesh');

    // measure it on its own
    const parent = model.parent;
    parent.remove(model);
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    parent.add(model);

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = this.data.size / Math.max(size.x, size.y, size.z);

    model.scale.setScalar(s);
    model.position.copy(center).multiplyScalar(-s);
    if (this.data.base) model.position.y += (size.y * s) / 2;
  }
});


// play-clips plays any animations saved in the model.
AFRAME.registerComponent('play-clips', {
  init: function () {
    this.el.addEventListener('model-loaded', (e) => {
      const model = e.detail.model;
      this.mixer = new THREE.AnimationMixer(model);
      model.animations.forEach((clip) => this.mixer.clipAction(clip).play());
    });
  },

  tick: function (time, delta) {
    if (this.mixer) this.mixer.update(delta / 1000);
  }
});
