async function fetchMe() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function requireAuth(allowedRoles) {
  const me = await fetchMe();
  if (!me || (allowedRoles && !allowedRoles.includes(me.role))) {
    location.href = "/login.html";
    return null;
  }
  return me;
}

async function initNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const me = await fetchMe();

  if (!me) {
    nav.innerHTML = `<a href="/index.html">Beranda</a> <a href="/login.html">Login</a>`;
    return;
  }

  const links = [];
  if (me.role === "tim") {
    links.push('<a href="/admin.html">Master Data</a>');
    links.push('<a href="/sesi.html">Input Sesi</a>');
    links.push('<a href="/rekap.html">Rekap Payroll</a>');
  } else if (me.role === "tentor") {
    links.push('<a href="/dashboard.html">Sesi Saya</a>');
    links.push('<a href="/rekap.html">Rekap Saya</a>');
  } else if (me.role === "siswa") {
    links.push('<a href="/dashboard.html">Sesi Saya</a>');
  }

  nav.innerHTML = `
    ${links.join(" ")}
    <span style="float:right">
      ${me.nama} (${me.role})
      <button id="btn-logout" type="button" style="margin-left:8px">Logout</button>
    </span>
  `;
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login.html";
  });
}

function compressImage(file, maxSize = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: null, lng: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");
