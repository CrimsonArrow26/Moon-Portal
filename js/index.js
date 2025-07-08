(function () {
  "use strict";

  // Only run if the container exists (integration-safe)
  var container = document.getElementById("moon-3d-container");
  if (!container) return;

  // Make HUD and loading elements optional for integration
  var hud = document.getElementById("hud");
  var loadingContainer = document.getElementById("loading-container");
  var loadingMessage = document.getElementById("loading-message");
  var normVertShader = document.getElementById("norm-vert-shader");
  var normFragShader = document.getElementById("norm-frag-shader");

  if (!Detector.webgl) {
    if (typeof Detector.addGetWebGLMessage === "function") {
      Detector.addGetWebGLMessage();
    }
    return;
  }

  var scene;
  var renderer;
  var camera;
  var clock;
  var controls;
  var stats;
  var moon;
  var starfield;
  var light = {
    speed: 0.1,
    distance: 1000,
    position: new THREE.Vector3(0, 0, 0),
    orbit: function (center, time) {
      this.position.x =
        (center.x + this.distance) * Math.sin(time * -this.speed);
      this.position.z =
        (center.z + this.distance) * Math.cos(time * this.speed);
    },
  };

  function createMoon(textureMap, normalMap) {
    var radius = 200;
    var xSegments = 50;
    var ySegments = 50;
    var geo = new THREE.SphereGeometry(radius, xSegments, ySegments);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        lightPosition: { type: "v3", value: light.position },
        textureMap: { type: "t", value: textureMap },
        normalMap: { type: "t", value: normalMap },
        uvScale: { type: "v2", value: new THREE.Vector2(1.0, 1.0) },
      },
     
      vertexShader: normVertShader ? normVertShader.textContent : "",
      fragmentShader: normFragShader ? normFragShader.textContent : "",
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.geometry.computeTangents();
    mesh.position.set(220, 0, 0); 
    mesh.rotation.set(0, 180, 0);
    scene.add(mesh);
    return mesh;
  }

  function createSkybox(texture) {
    var size = 15000;
    var cubemap = THREE.ShaderLib.cube;
    cubemap.uniforms.tCube.value = texture;
    var mat = new THREE.ShaderMaterial({
      fragmentShader: cubemap.fragmentShader,
      vertexShader: cubemap.vertexShader,
      uniforms: cubemap.uniforms,
      depthWrite: false,
      side: THREE.BackSide,
    });
    var geo = new THREE.CubeGeometry(size, size, size);
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
  }

  function init() {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 1);
   
    var width = container.offsetWidth || window.innerWidth;
    var height = container.offsetHeight || window.innerHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    var fov = 35;
    var aspect = width / height;
    var near = 1;
    var far = 65536;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, 800);
    scene = new THREE.Scene();
    scene.add(camera);
    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 0.5;
    controls.dynamicDampingFactor = 0.5;
    if (stats && hud) {
      stats.domElement.style.position = "absolute";
      stats.domElement.style.bottom = "0px";
      hud.appendChild(stats.domElement);
    }
    clock = new THREE.Clock();

   
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (!renderer || !camera) return; 
        var width = container.offsetWidth || window.innerWidth;
        var height = container.offsetHeight || window.innerHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    light.orbit(moon.position, clock.getElapsedTime());
    controls.update(camera);
    if (stats) stats.update();
    renderer.render(scene, camera);
  }

  function toggleHud() {
    if (hud)
      hud.style.display = hud.style.display === "none" ? "block" : "none";
  }

  function onDocumentKeyDown(evt) {
    switch (evt.keyCode) {
      case "H".charCodeAt(0):
        toggleHud();
        break;
      case "F".charCodeAt(0):
        if (window.screenfull && screenfull.enabled) screenfull.toggle();
        break;
      case "P".charCodeAt(0):
        window.open(renderer.domElement.toDataURL("image/png"));
        break;
    }
  }

  function onWindowResize() {
    var width = container.offsetWidth || window.innerWidth;
    var height = container.offsetHeight || window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function loadAssets(options) {
    var paths = options.paths;
    var onBegin = options.onBegin;
    var onComplete = options.onComplete;
    var onProgress = options.onProgress;
    var total = 0;
    var completed = 0;
    var textures = {};
    var key;
    for (key in paths) if (paths.hasOwnProperty(key)) total++;
    if (typeof onBegin === "function") {
      onBegin({ total: total, completed: completed });
    }
    for (key in paths) {
      if (paths.hasOwnProperty(key)) {
        var path = paths[key];
        if (typeof path === "string")
          THREE.ImageUtils.loadTexture(path, null, getOnLoad(path, key));
        else if (typeof path === "object")
          THREE.ImageUtils.loadTextureCube(path, null, getOnLoad(path, key));
      }
    }
    function getOnLoad(path, name) {
      return function (tex) {
        textures[name] = tex;
        completed++;
        if (typeof onProgress === "function") {
          onProgress({
            path: path,
            name: name,
            total: total,
            completed: completed,
          });
        }
        if (completed === total && typeof onComplete === "function") {
          onComplete({ textures: textures });
        }
      };
    }
  }

  function onWindowLoaded() {
    loadAssets({
      paths: {
        moon: "img/maps/moon.jpg",
        moonNormal: "img/maps/normal.jpg",
        starfield: [
          "img/starfield/front.png",
          "img/starfield/back.png",
          "img/starfield/left.png",
          "img/starfield/right.png",
          "img/starfield/top.png",
          "img/starfield/bottom.png",
        ],
      },
      onBegin: function () {
        if (loadingContainer) loadingContainer.style.display = "block";
      },
      onProgress: function (evt) {
        if (loadingMessage) loadingMessage.innerHTML = evt.name;
      },
      onComplete: function (evt) {
        if (loadingContainer) loadingContainer.style.display = "none";
        var textures = evt.textures;
        moon = createMoon(textures.moon, textures.moonNormal);
        starfield = createSkybox(textures.starfield);
        animate();
      },
    });
    init();
    onWindowResize();
  }

  window.addEventListener("load", onWindowLoaded, false);
  window.addEventListener("resize", onWindowResize, false);
  document.addEventListener("keydown", onDocumentKeyDown, false);

  
  window.resetMoonView = function () {
    if (camera) camera.position.set(0, 0, 800);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.reset(); 
    }
    if (moon) moon.rotation.set(0, 180, 0);
  };
})();
