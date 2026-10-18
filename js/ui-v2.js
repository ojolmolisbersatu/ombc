// OMB Charger v2.0, tampilan saja: Home (daftar stasiun), Detail Stasiun, Pengaturan Sesi, Scan, QR lokasi.
// Dimuat dari index.html setelah js/app.js. Gaya (CSS) ada di index.html.
// Alur sesi/bayar/login TIDAK diubah: tombol Mulai memakai aksi "start" yang sudah ada.
(function () {
  S.v = "home"; S.stm = "kwh"; S.skwh = ""; S.snom = ""; S.sq = ""; S.stations = [];
  var qs = new URLSearchParams(location.search);
  if (qs.get("socket")) S.deep = { st: qs.get("station"), so: qs.get("socket") };

  // ===== data stasiun (tabel charge_stations; kalau belum ada, dipakai satu stasiun bawaan) =====
  async function loadStations() {
    var r = await sb.from("charge_stations").select("*").eq("is_active", true).order("id");
    S.stations = r.error ? [] : (r.data || []);
    if (S.user && !(document.activeElement && document.activeElement.tagName === "INPUT")) { S.sig = ""; render(); }
  }
  function avail(o) { return o.is_available && !S.busy[o.id]; }
  function stList() {
    var a = S.stations.length ? S.stations : [{ id: 0, name: "OMB Charger", address: "", photo_url: "", open_hours: "00:00-00:00" }];
    return a.map(function (x) {
      var os = S.outlets.filter(function (o) { return o.station_id == null ? x.id === a[0].id : o.station_id === x.id; });
      return { s: x, os: os, free: os.filter(avail).length, up: os.filter(function (o) { return o.is_available; }).length };
    });
  }
  function stat(z) {
    return z.free > 0 ? '<span class="dot"></span>' + z.free + "/" + z.os.length + " tersedia" :
      z.up > 0 ? '<span class="dot use"></span>Sedang penuh' : '<span class="dot off"></span>Tidak tersedia';
  }
  function img(x, c) { return '<div class="' + c + '">' + (x.photo_url ? '<img src="' + esc(x.photo_url) + '" alt="">' : BOLT) + "</div>"; }
  function hrs(x) { return x.open_hours === "00:00-00:00" ? "Buka 24 jam" : esc(x.open_hours); }
  function curStation() { return stList().filter(function (z) { return z.s.id === S.stId; })[0]; }

  // ===== target & biaya (hanya perkiraan; tagihan asli dihitung server dari pemakaian) =====
  function curWh() {
    if (S.stm === "nom") { var n = parseInt(S.snom, 10) || 0; return S.tariff > 0 ? Math.floor(n / S.tariff * 100) * 10 : 0; }
    var p = parseFloat(String(S.skwh || "").replace(",", "."));
    return isFinite(p) && p > 0 ? Math.round(p * 1000) : 0;
  }
  function est(w) { return Math.ceil(w * S.tariff / 100000) * 100; }
  function sync() { var w = curWh(); S.tgt = w > 0 ? "custom" : null; S.custom = w > 0 ? String(w / 1000) : ""; return w; }
  function selOk() { var o = S.outlets.filter(function (x) { return x.id === S.outlet; })[0]; return !!(o && avail(o)); }

  // ===== tampilan =====
  function homeView() {
    return (S.user ? '<p class="hello">Halo, ' + esc(nm()) + " 👋</p>" + coinCard() + pendTop()
      : '<div class="row sp"><p class="hello">Pilih lokasi charge</p><button class="sm acc" data-ui="login">Masuk</button></div>') +
      '<input id="sq" type="search" placeholder="Cari lokasi pengecasan" value="' + esc(S.sq) + '" style="margin:8px 0 4px">' +
      "<h2>Stasiun</h2><div id=\"stl\">" + stCards() + "</div>";
  }
  function stCards() {
    var q = S.sq.trim().toLowerCase();
    var l = stList().filter(function (z) { return !q || (z.s.name + " " + (z.s.address || "")).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return b.free - a.free; });
    if (!l.length) return '<p class="mute">Lokasi tidak ditemukan.</p>';
    return l.map(function (z) {
      return '<div class="stc" role="button" tabindex="0" data-ui="st" data-v="' + z.s.id + '">' + img(z.s, "th") +
        '<div class="stm"><b>' + esc(z.s.name) + '</b><div class="mute clamp">' + esc(z.s.address || "") + '</div><div class="mute">' + stat(z) + "</div></div>" +
        '<div class="stp"><b>' + rp(S.tariff) + "</b><small>/kWh</small></div></div>";
    }).join("");
  }

  function stView() {
    var z = curStation(); if (!z) { S.v = "home"; return homeView(); }
    var x = z.s, base = location.origin + location.pathname;
    var rows = z.os.map(function (o) {
      var ok = avail(o);
      return '<button class="oc" style="width:100%;margin:6px 0" data-ui="pick" data-v="' + o.id + '"' + (ok ? "" : " disabled") + ">" + BOLT +
        "<span>" + esc(o.name) + '<small><span class="dot' + (S.busy[o.id] ? " use" : ok ? "" : " off") + '"></span>' +
        (S.busy[o.id] ? "Dipakai" : o.is_available ? "Tersedia" : "Tidak tersedia") + "</small></span></button>";
    }).join("");
    var qr = S.admin ? '<div class="card qrprint"><div class="row sp"><b>QR Colokan</b><button class="sm ghost" data-ui="print">Cetak</button></div>' +
      '<div class="mute">Tempel di tiap colokan. Scan membuka Pengaturan Sesi.</div><div class="lqbox">' +
      z.os.map(function (o) {
        return '<div class="lq"><div class="qi" data-url="' + esc(base + "?station=" + x.id + "&socket=" + o.id) + '"></div><b>' + esc(o.name) + "</b></div>";
      }).join("") + "</div></div>" : "";
    return '<div class="topbar"><button data-ui="home" aria-label="Kembali">←</button><b>Detail Stasiun</b></div>' +
      img(x, "hero") + '<div class="card"><b>' + esc(x.name) + '</b><div class="mute">' + esc(x.address || "") + '</div><div class="mute" style="margin-top:6px">' + stat(z) + "</div></div>" +
      '<div class="card"><b>Pilih Colokan</b>' + rows + "</div>" +
      '<div class="card"><b>Informasi Biaya</b><div class="kv"><span>Tarif</span><b style="color:var(--acc)">' + rp(S.tariff) + "/kWh</b></div></div>" +
      '<div class="card"><b>Informasi Dasar</b><div class="kv"><span>Jam operasional</span><b>' + hrs(x) + "</b></div></div>" + qr +
      '<button class="big acc" data-ui="sess"' + (z.free ? "" : " disabled") + ">⚡ Mulai Charge</button>";
  }

  function sessView() {
    var z = curStation(); if (!z) { S.v = "home"; return homeView(); }
    if (!selOk()) { var f = z.os.filter(avail)[0]; if (f) S.outlet = f.id; }
    var w = sync(), over = w > S.maxWh, nom = S.stm === "nom";
    var oc = z.os.map(function (o) {
      var ok = avail(o);
      return '<button class="oc ' + (S.outlet === o.id ? "sel" : "") + '" data-act="outlet" data-v="' + o.id + '"' + (ok ? "" : " disabled") + ">" + BOLT +
        "<span>" + esc(o.name) + '<small><span class="dot' + (S.busy[o.id] ? " use" : ok ? "" : " off") + '"></span>' + (S.busy[o.id] ? "Dipakai" : o.is_available ? "Tersedia" : "Tidak tersedia") + "</small></span></button>";
    }).join("");
    var vals = nom ? [5000, 10000, 15000, 20000] : [1, 2, 3, 5].filter(function (n) { return n * 1000 <= S.maxWh; });
    var chips = vals.map(function (n) { return '<button data-ui="chip" data-v="' + n + '">' + (nom ? rp(n) : n + " Poin") + "</button>"; }).join("");
    return '<div class="topbar"><button data-ui="back" aria-label="Kembali">←</button><b>Pengaturan Sesi</b></div>' +
      '<div class="card"><b>' + esc(z.s.name) + '</b><div class="mute">Tarif ' + rp(S.tariff) + "/kWh</div></div>" +
      '<div class="card"><b>Pilih Colokan</b><div class="ocs" style="margin-top:8px">' + oc + "</div></div>" +
      '<div class="card"><div class="seg"><button class="' + (nom ? "" : "sel") + '" data-ui="mode" data-v="kwh">Poin</button><button class="' + (nom ? "sel" : "") + '" data-ui="mode" data-v="nom">Nominal</button></div>' +
      '<div class="mute">' + (nom ? "Masukkan nominal pengecasan dalam rupiah." : "Masukkan jumlah Poin (1 Poin = 1 kWh).") + "</div>" +
      (nom ? '<input id="sn" type="number" inputmode="numeric" min="1000" step="500" placeholder="Contoh: 10000" value="' + esc(S.snom) + '" style="margin-top:8px">'
        : '<input id="sk" type="number" inputmode="decimal" min="0.01" step="0.01" max="' + (S.maxWh / 1000) + '" placeholder="Maks ' + (S.maxWh / 1000).toLocaleString("id-ID") + ' Poin" value="' + esc(S.skwh) + '" style="margin-top:8px">') +
      '<div class="chips row" style="margin-top:10px">' + chips + "</div></div>" +
      '<div class="card" style="text-align:center"><span class="num" id="sp">' + poin(w) + '</span> <span class="mute">Poin</span><div class="mute">Perkiraan biaya <b id="sr">' + rp(est(w)) + '</b></div>' +
      '<div id="sw" class="mute" style="color:var(--bad)">' + (over ? "Maksimal " + poin(S.maxWh) + " Poin" : "") + '</div></div>' +
      '<p class="mute">Tagihan dihitung dari pemakaian saat sesi berakhir.</p><div style="height:70px"></div>' +
      '<div class="bottombar"><div><span class="mute">Perkiraan</span><br><b id="stot">' + rp(est(w)) + '</b></div><button id="startBtn" class="acc" ' + (S.user ? 'data-act="start"' : 'data-ui="needlogin"') + '' + (w > 0 && !over && selOk() ? "" : " disabled") + ">" + (S.user ? "⚡ Mulai Charge" : "Masuk untuk Mulai") + "</button></div>";
  }

  var uv0 = userView;
  userView = function () {
    var s = S.sess;
    if ((s && (s.status === "pending" || s.status === "running")) || S.topupOpen || (s && s.payment_status === "unpaid")) { S.v = "home"; return uv0(); }
    return S.v === "session" ? sessView() : S.v === "station" ? stView() : homeView();
  };

  navBar = function () {
    var it = [["charge", "home", "Home"], ["riwayat", "riwayat", "Riwayat"], ["setting", "setting", "Setting"], ["profil", "profil", "Profil"]];
    if (S.admin) it.push(["admin", "admin", "Admin", S.tops.length + S.unpaid.length]);
    var out = it.map(function (x) {
      return '<button class="' + (S.tab === x[0] ? "on" : "") + '" data-act="tab" data-v="' + x[0] + '">' + ic(x[1]) + x[2] + (x[3] ? '<span class="badge">' + x[3] + "</span>" : "") + "</button>";
    });
    out.splice(2, 0, '<button class="scanfab" data-ui="scan" aria-label="Scan barcode"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18"/></svg></button>');
    return '<nav class="nav">' + out.join("") + "</nav>";
  };

  var r0 = render;
  render = function () {
    r0();
    document.querySelectorAll(".qi[data-url]").forEach(function (e) {
      try { new QRCode(e, { text: e.dataset.url, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M }); } catch (x) {}
    });
  };

  // ===== navigasi =====
  function go(st, so) {
    var l = stList(), z = l.filter(function (a) { return String(a.s.id) === String(st); })[0] || l[0];
    var o = S.outlets.filter(function (x) { return String(x.id) === String(so); })[0];
    S.tab = "charge"; S.topupOpen = false; S.stId = z.s.id; S.skwh = ""; S.snom = "";
    if (o && avail(o)) { S.outlet = o.id; S.v = "session"; }
    else { S.v = "station"; if (o) toast(o.name + " sedang dipakai atau tidak tersedia"); }
    S.sig = ""; render(); window.scrollTo(0, 0);
  }
  function view(v) { S.v = v; S.sig = ""; render(); window.scrollTo(0, 0); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act='tab']");
    if (t && t.dataset.v === "charge") S.v = "home";
    var b = e.target.closest("[data-ui]"); if (!b) return;
    var a = b.dataset.ui, v = b.dataset.v;
    if (a === "st") { S.stId = Number(v); return view("station"); }
    if (a === "home") return view("home");
    if (a === "back") return view("station");
    if (a === "sess") { var z = curStation(), f = z && z.os.filter(avail)[0]; if (!f) return toast("Belum ada colokan tersedia"); S.outlet = f.id; S.skwh = ""; S.snom = ""; return view("session"); }
    if (a === "pick") { S.outlet = Number(v); S.skwh = ""; S.snom = ""; return view("session"); }
    if (a === "mode") { S.stm = v; return view("session"); }
    if (a === "chip") { if (S.stm === "nom") S.snom = v; else S.skwh = v; return view("session"); }
    if (a === "print") return window.print();
    if (a === "scan") return scan();
    if (a === "login" || a === "needlogin") { if (a === "needlogin") S.deep = { st: S.stId, so: S.outlet }; S.wantLogin = true; return login(); }
    if (a === "guestback") { S.wantLogin = false; S.deep = null; return guestStart(); }
  });
  document.addEventListener("keydown", function (e) {
    var c = e.target.closest && e.target.closest(".stc");
    if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); c.click(); }
  });

  function put(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
  document.addEventListener("input", function (e) {
    var id = e.target.id;
    if (id === "sq") { S.sq = e.target.value; var l = document.getElementById("stl"); if (l) l.innerHTML = stCards(); }
    if (id === "sk" || id === "sn") {
      if (id === "sk") S.skwh = e.target.value; else S.snom = e.target.value;
      var w = sync(), over = w > S.maxWh;
      put("sp", poin(w)); put("sr", rp(est(w))); put("stot", rp(est(w))); put("sw", over ? "Maksimal " + poin(S.maxWh) + " Poin" : "");
      var sbtn = document.getElementById("startBtn"); if (sbtn) sbtn.disabled = !(w > 0 && !over && selOk());
      document.querySelectorAll(".chips button").forEach(function (c) { c.classList.remove("sel"); });
    }
  });

  // ===== scan QR colokan (BarcodeDetector: Chrome Android) =====
  async function scan() {
    if (!("BarcodeDetector" in window)) return toast("Scan di aplikasi belum didukung browser ini. Scan QR dengan kamera HP lalu buka linknya.");
    var ov = document.createElement("div"); ov.className = "scanov";
    ov.innerHTML = '<video playsinline muted></video><p>Arahkan kamera ke QR di colokan</p><button class="big">Tutup</button>';
    document.body.appendChild(ov);
    var vd = ov.querySelector("video"), stream, run = true;
    function stop() { run = false; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); ov.remove(); }
    ov.querySelector("button").onclick = stop;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); vd.srcObject = stream; await vd.play(); }
    catch (err) { stop(); return toast("Kamera tidak bisa dibuka. Izinkan akses kamera."); }
    var det = new BarcodeDetector({ formats: ["qr_code"] });
    while (run) {
      try {
        var r = await det.detect(vd);
        if (r.length) {
          var u = new URL(r[0].rawValue), so = u.searchParams.get("socket");
          if (so) { stop(); return go(u.searchParams.get("station"), so); }
        }
      } catch (err) {}
      await new Promise(function (f) { setTimeout(f, 300); });
    }
  }

  // ===== Mode tamu: lokasi bisa dilihat tanpa login; login diminta saat mau mulai charge =====
  async function guestLoad() {
    var r = await sb.rpc("public_overview");
    if (r.error || !r.data) { toast("Lokasi belum bisa dimuat"); return; }
    var d = r.data;
    S.stations = d.stations || []; S.outlets = d.outlets || []; S.tariff = d.tariff || 0; S.maxWh = d.max_wh || 5000;
    S.busy = {}; (d.busy || []).forEach(function (id) { S.busy[id] = true; });
  }
  async function guestStart() {
    S.guest = true; S.wantLogin = false;
    $app.innerHTML = head() + '<p class="mute">Memuat lokasi...</p>';
    await guestLoad();
    if (S.deep) { var d = S.deep; S.deep = null; history.replaceState(null, "", location.pathname); return go(d.st, d.so); }
    S.v = "home"; render();
  }
  function guestNav() {
    return '<nav class="nav"><button class="on" data-ui="home">' + ic("home") + 'Lokasi</button>' +
      '<button class="scanfab" data-ui="scan" aria-label="Scan barcode"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18"/></svg></button>' +
      '<button data-ui="login">' + ic("profil") + "Masuk</button></nav>";
  }
  var login0 = login;
  login = function (err) {
    if (!err && !S.wantLogin) return guestStart();
    login0(err);
    var c = document.querySelector(".card");
    if (S.guest && c) c.insertAdjacentHTML("beforeend", '<button class="ghost big" style="margin-top:10px" data-ui="guestback">Kembali ke daftar lokasi</button>');
  };
  var r1 = render;
  render = function () {
    if (S.user) { S.wantLogin = false; S.guest = false; return r1(); }
    if (S.guest && !S.wantLogin) { $app.innerHTML = head() + userView() + guestNav(); return; }
    return r1();
  };
  setInterval(function () {
    if (S.user || !S.guest || S.wantLogin || (document.activeElement && document.activeElement.tagName === "INPUT")) return;
    var before = JSON.stringify([S.busy, S.outlets, S.tariff, S.stations]);
    guestLoad().then(function () { if (before !== JSON.stringify([S.busy, S.outlets, S.tariff, S.stations])) render(); });
  }, 10000);

  // ===== jalankan =====
  setInterval(function () {
    if (!S.user) { S.stLoaded = false; return; }
    if (!S.stLoaded) { S.stLoaded = true; loadStations(); }
    if (S.deep && S.outlets.length) { var d = S.deep; S.deep = null; history.replaceState(null, "", location.pathname); go(d.st, d.so); }
  }, 1000);
  setInterval(function () { if (S.user) loadStations(); }, 60000);
  // Jaga-jaga: layar login lama sempat tampil sebelum skrip ini siap.
  if (!S.user && $app.querySelector("#em")) guestStart();
})();
