(() => {
  'use strict';
  const travel = document.querySelector('#travel');
  if (!travel) return;
  const canvas = travel.querySelector('#travel-globe');
  const details = travel.querySelector('#travel-selection');
  const buttons = [...travel.querySelectorAll('[data-travel-region]')];
  if (!canvas || !details) return;
  const ctx = canvas.getContext('2d');
  const rad = Math.PI / 180;
  const home = [104, 30];
  const locations = {
    MY: [['Penang', '槟城', 100.3, 5.4], ['Kota Kinabalu', '亚庇', 116.07, 5.98]],
    SG: [['Singapore', '新加坡', 103.82, 1.35]],
    TH: [['Bangkok', '曼谷', 100.50, 13.76], ['Phuket', '普吉岛', 98.34, 7.89]],
    ID: [['Bali', '巴厘岛', 115.19, -8.41]],
    AE: [['Dubai', '迪拜', 55.27, 25.20], ['Abu Dhabi', '阿布扎比', 54.37, 24.45]],
    TR: [['Istanbul', '伊斯坦布尔', 28.98, 41.01], ['Antalya', '安塔利亚', 30.71, 36.90], ['Cappadocia', '卡帕多奇亚', 34.83, 38.64]],
    BR: [['Rio de Janeiro', '里约热内卢', -43.17, -22.91]],
    GB: [['London', '伦敦', -0.13, 51.51], ['Cambridge', '剑桥', 0.12, 52.21]]
  };
  const provinces = {
    AH: ['Anhui', '安徽'], BJ: ['Beijing', '北京'], CQ: ['Chongqing', '重庆'], FJ: ['Fujian', '福建'],
    GD: ['Guangdong', '广东'], GS: ['Gansu', '甘肃'], GX: ['Guangxi', '广西'], GZ: ['Guizhou', '贵州'],
    HA: ['Henan', '河南'], HB: ['Hubei', '湖北'], HI: ['Hainan', '海南'],
    HK: ['Hong Kong', '香港'], HN: ['Hunan', '湖南'], JS: ['Jiangsu', '江苏'], LN: ['Liaoning', '辽宁'],
    MO: ['Macao', '澳门'], NM: ['Inner Mongolia', '内蒙古'], NX: ['Ningxia', '宁夏'], QH: ['Qinghai', '青海'],
    SC: ['Sichuan', '四川'], SD: ['Shandong', '山东'], SH: ['Shanghai', '上海'], SN: ['Shaanxi', '陕西'],
    SX: ['Shanxi', '山西'], TJ: ['Tianjin', '天津'], XJ: ['Xinjiang', '新疆'], YN: ['Yunnan', '云南'], ZJ: ['Zhejiang', '浙江']
  };
  const smallRegions = {HK: [114.17, 22.32], MO: [113.55, 22.20]};

  let region = 'CN', province = null, city = null;
  let longitude = home[0], latitude = home[1];
  let side = 0, radius = 0, image, surface, texels, renderRequest;
  let mapUnavailable = false;
  const features = [];
  const width = 2048, height = width / 2;
  const texture = document.createElement('canvas');
  texture.width = width;
  texture.height = height;
  const map = texture.getContext('2d', {willReadFrequently: true});

  function bilingual(english, chinese) {
    const fragment = document.createDocumentFragment();
    for (const [lang, cls, text] of [['en', 'en', english], ['zh-CN', 'zh', chinese]]) {
      const span = document.createElement('span');
      span.lang = lang;
      span.className = cls;
      span.textContent = text;
      fragment.append(span);
    }
    return fragment;
  }

  function showPlaces() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.travelRegion === region)));
    details.replaceChildren();
    if (region === 'CN') {
      if (province) details.append(bilingual(...provinces[province]), ' · ');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'travel-city';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', 'travel-province-list');
      const count = Object.keys(provinces).length;
      toggle.append(bilingual(`${count} provincial-level regions visited`, `走过 ${count} 个省级行政区`));
      const list = document.createElement('span');
      list.id = 'travel-province-list';
      list.className = 'travel-province-list';
      list.hidden = true;
      const names = Object.values(provinces).sort((a,b) => a[0].localeCompare(b[0]));
      list.append(bilingual(names.map(pair => pair[0]).join(', '), names.map(pair => pair[1]).join('、')));
      toggle.addEventListener('click', () => {
        list.hidden = !list.hidden;
        toggle.setAttribute('aria-expanded', String(!list.hidden));
      });
      details.append(toggle, list);
      return;
    }
    locations[region].forEach((place, i) => {
      if (i) details.append(' · ');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'travel-city';
      button.setAttribute('aria-pressed', String(city === place));
      button.append(bilingual(place[0], place[1]));
      button.addEventListener('click', () => {
        city = place;
        details.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        orient(place[2], place[3]);
      });
      details.append(button);
    });
  }

  function choose(code, place = null, subdivision = null) {
    if (code !== 'CN' && !locations[code]) return;
    region = code;
    city = place;
    province = subdivision;
    showPlaces();
    if (features.length) paintTexture();
    if (subdivision) { requestDraw(); return; }
    const places = locations[code];
    if (place) orient(place[2], place[3]);
    else if (places) {
      const mean = index => places.reduce((sum, entry) => sum + entry[index], 0) / places.length;
      orient(mean(2), mean(3));
    } else orient(...home);
  }

  // Rasterize geography in longitude/latitude space once per region change.
  // Inverse projection then handles horizons, holes and the international date line.
  function makePath(feature) {
    const path = new Path2D();
    const {type, coordinates} = feature.geometry;
    for (const polygon of type === 'Polygon' ? [coordinates] : coordinates) {
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          const x = (lon + 180) * width / 360;
          const y = (90 - lat) * height / 180;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
      }
    }
    return path;
  }

  function paintTexture() {
    map.fillStyle = '#cce2e5';
    map.fillRect(0, 0, width, height);
    map.lineWidth = 1;
    map.strokeStyle = '#b7d4d7';
    map.beginPath();
    for (let lon = -180; lon < 180; lon += 15) {
      const x = (lon + 180) * width / 360;
      map.moveTo(x, 0); map.lineTo(x, height);
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const y = (90 - lat) * height / 180;
      map.moveTo(0, y); map.lineTo(width, y);
    }
    map.stroke();
    for (const {id, path, subdivision} of features) {
      const visited = subdivision ? Boolean(provinces[subdivision]) : Boolean(locations[id]);
      const selected = visited && (subdivision ? subdivision === province : id === region);
      map.fillStyle = selected ? '#286b61' : visited ? '#68a191' : '#e0e2d6';
      map.strokeStyle = visited ? '#b4d1bd' : '#b7c7ba';
      map.lineWidth = .9;
      map.fill(path, 'evenodd');
      map.stroke(path);
    }
    texels = map.getImageData(0, 0, width, height).data;
  }

  function updateSize() {
    const size = Math.max(1, Math.min(480, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1))));
    if (size === side || !ctx) return;
    side = size;
    canvas.width = canvas.height = size;
    radius = size * .465;
    image = ctx.createImageData(size, size);
    surface = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      const north = (size / 2 - y - .5) / radius;
      for (let x = 0; x < size; x++) {
        const east = (x + .5 - size / 2) / radius;
        surface[y * size + x] = Math.sqrt(Math.max(0, 1 - east * east - north * north));
      }
    }
    requestDraw();
  }

  function orient(lon, lat) {
    longitude = ((lon + 540) % 360 + 360) % 360 - 180;
    latitude = Math.max(-89, Math.min(89, lat));
    requestDraw();
  }
  function requestDraw() {
    if (!renderRequest && !mapUnavailable) renderRequest = requestAnimationFrame(draw);
  }
  function project(lon, lat) {
    const delta = (lon - longitude) * rad;
    const phi = lat * rad, tilt = latitude * rad;
    const along = Math.cos(phi) * Math.cos(delta);
    return [
      side / 2 + radius * Math.cos(phi) * Math.sin(delta),
      side / 2 - radius * (Math.sin(phi) * Math.cos(tilt) - along * Math.sin(tilt)),
      Math.sin(phi) * Math.sin(tilt) + along * Math.cos(tilt)
    ];
  }

  function draw() {
    renderRequest = 0;
    if (!texels || !side || !ctx) return;
    const ct = Math.cos(latitude * rad), st = Math.sin(latitude * rad);
    const offset = (longitude + 180) / 360;
    const pixels = image.data;
    for (let y = 0; y < side; y++) {
      const north = (side / 2 - y - .5) / radius;
      for (let x = 0; x < side; x++) {
        const i = y * side + x, front = surface[i];
        if (!front) continue;
        const east = (x + .5 - side / 2) / radius;
        const lon = Math.atan2(east, front * ct - north * st);
        const lat = Math.asin(Math.max(-1, Math.min(1, north * ct + front * st)));
        const tx = (Math.floor(width * (offset + lon / (2 * Math.PI))) + width) % width;
        const ty = Math.min(height - 1, Math.floor(height * (.5 - lat / Math.PI)));
        const source = 4 * (ty * width + tx);
        const shade = .91 + .095 * front + .018 * (north - east);
        for (let c = 0; c < 3; c++) pixels[4*i+c] = texels[source+c] * shade;
        pixels[4*i+3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    ctx.beginPath();
    ctx.arc(side/2, side/2, radius, 0, 2*Math.PI);
    ctx.lineWidth = Math.max(.7, side / 500);
    ctx.strokeStyle = '#819f9e';
    ctx.stroke();
    // Keep both coastal SARs visible even when their outlines are subpixel.
    for (const [code, point] of Object.entries(smallRegions)) {
      const [x, y, front] = project(...point);
      if (front <= .035) continue;
      ctx.beginPath();
      ctx.arc(x, y, side * .0045, 0, 2*Math.PI);
      ctx.fillStyle = code === province ? '#1b594f' : '#388174';
      ctx.fill();
    }
    function pin(place) {
      const [x, y, front] = project(place[2], place[3]);
      if (front < .035) return;
      ctx.beginPath();
      ctx.arc(x, y, side * (city === place ? .013 : .008), 0, Math.PI * 2);
      ctx.fillStyle = city === place ? '#863e28' : '#b15e3d';
      ctx.fill();
      ctx.lineWidth = Math.max(1, side / 320);
      ctx.strokeStyle = '#fff5db';
      ctx.stroke();
    }
    Object.values(locations).flat().forEach(pin);
    if (city) pin(city);
  }

  function selectAt(event) {
    if (!texels || !side) return;
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) * side / box.width;
    const y = (event.clientY - box.top) * side / box.height;
    let nearest = null, distance = side * 9 / box.width;
    for (const [code, places] of Object.entries(locations)) {
      for (const place of places) {
        const [px, py, front] = project(place[2], place[3]);
        const d = Math.hypot(x - px, y - py);
        if (front > .035 && d < distance) { nearest = [code, place]; distance = d; }
      }
    }
    if (nearest) { choose(...nearest); return; }
    let sar = null;
    distance = side * 3 / box.width;
    for (const [code, point] of Object.entries(smallRegions)) {
      const [px, py, front] = project(...point);
      const d = Math.hypot(x - px, y - py);
      if (front > .035 && d < distance) { sar = code; distance = d; }
    }
    if (sar) { choose('CN', null, sar); return; }
    const east = (x - side / 2) / radius, north = (side / 2 - y) / radius;
    const front = Math.sqrt(1 - east * east - north * north);
    if (!Number.isFinite(front)) return;
    const tilt = latitude * rad;
    const lon = longitude + Math.atan2(east, front * Math.cos(tilt) - north * Math.sin(tilt)) / rad;
    const lat = Math.asin(north * Math.cos(tilt) + front * Math.sin(tilt)) / rad;
    const tx = ((lon + 540) % 360) * width / 360, ty = (90 - lat) * height / 180;
    for (let i = features.length - 1; i >= 0; i--) {
      const {id, path, subdivision} = features[i];
      if (!map.isPointInPath(path, tx, ty, 'evenodd')) continue;
      if (subdivision && provinces[subdivision]) choose('CN', null, subdivision);
      else if (locations[id]) choose(id);
      break;
    }
  }

  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    drag = {x:event.clientX, y:event.clientY, lon:longitude, lat:latitude, moved:false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || !event.isPrimary) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) {
      const scale = 135 / Math.max(1, canvas.clientWidth);
      orient(drag.lon - dx * scale, drag.lat + dy * scale);
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (drag && !drag.moved && event.isPrimary) selectAt(event);
    drag = null;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  const rotations = {left:[-20,0], right:[20,0], up:[0,15], down:[0,-15]};
  function rotate(direction) {
    if (direction === 'home') choose('CN');
    else if (rotations[direction]) {
      const [dx,dy] = rotations[direction];
      orient(longitude + dx, latitude + dy);
    }
  }
  canvas.addEventListener('keydown', event => {
    const direction = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', Home:'home'}[event.key];
    if (direction) { event.preventDefault(); rotate(direction); }
  });
  buttons.forEach(button => button.addEventListener('click', () => choose(button.dataset.travelRegion)));
  travel.querySelectorAll('[data-travel-rotate]').forEach(button =>
    button.addEventListener('click', () => rotate(button.dataset.travelRotate)));
  function localizeLabel() {
    canvas.setAttribute('aria-label', document.documentElement.lang.startsWith('zh')
      ? '旅行地球，可用方向键旋转，Home 键复位' : 'Travel globe. Use arrow keys to rotate and Home to reset.');
  }
  new MutationObserver(localizeLabel).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  localizeLabel();
  showPlaces();
  function unavailable() {
    mapUnavailable = true;
    canvas.hidden = true;
    canvas.style.display = 'none';
    travel.querySelectorAll('.travel-controls, .travel-map-hint').forEach(el => { el.style.display = 'none'; });
    const note = document.createElement('p');
    note.className = 'travel-error';
    note.append(bilingual('The globe could not be loaded. Choose a region to explore the places.', '地球暂时无法加载。点选地区可查看旅行目的地。'));
    canvas.after(note);
  }
  if (!ctx || !map) { unavailable(); return; }
  if ('ResizeObserver' in window) new ResizeObserver(updateSize).observe(canvas);
  else window.addEventListener('resize', updateSize);
  updateSize();
  fetch('assets/travel-map.json').then(response => {
    if (!response.ok) throw Error('Map unavailable');
    return response.json();
  }).then(collection => {
    if (!Array.isArray(collection.features) || !collection.features.length) throw Error('Map contains no geometry');
    for (const feature of collection.features) {
      const id = feature.properties.id;
      if (!feature.geometry || !['Polygon','MultiPolygon'].includes(feature.geometry.type)) continue;
      features.push({id, subdivision:id.startsWith('CN-') ? id.slice(3) : null, path:makePath(feature)});
    }
    paintTexture();
    requestDraw();
  }).catch(unavailable);
})();
