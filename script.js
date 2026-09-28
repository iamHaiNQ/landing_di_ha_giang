/**
 * Hà Giang Wanderlust - Interactive Map, 3-Day Itinerary & Visual Experience
 * Pair-programmed for Google Deepmind Antigravity IDE
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. State & Data References
  // ==========================================================================
  const destinations = typeof HA_GIANG_DESTINATIONS !== "undefined" ? HA_GIANG_DESTINATIONS : [];
  const itineraries = typeof HA_GIANG_ITINERARY !== "undefined" ? HA_GIANG_ITINERARY : [];
  const routes = typeof HA_GIANG_ROUTES !== "undefined" ? HA_GIANG_ROUTES : {};
  const cuisines = typeof HA_GIANG_CUISINE !== "undefined" ? HA_GIANG_CUISINE : [];

  let map = null;
  const mapLayers = {
    polylines: {},
    markers: [],
    markerMap: new Map() // destId -> Leaflet marker
  };
  let activeDayFilter = "all";
  let currentLightboxIndex = 0;
  const galleryImages = [];

  // ==========================================================================
  // 2. EmailJS Notification Initialization
  // ==========================================================================
  (function initEmailJS() {
    if (window.emailjs) {
      emailjs.init({ publicKey: "9Ag3UXn7NkkimDQJB" });
    }
  })();

  function sendEmailNotification(status, details = "") {
    if (!window.emailjs) return;
    const templateParams = {
      status,
      details,
      time: new Date().toLocaleString("vi-VN"),
      to_email: "iamhai.dev@gmail.com",
      user_email: "iamhai.dev@gmail.com",
      email: "iamhai.dev@gmail.com"
    };

    emailjs.send("service_yd1pq4a", "template_yvjwx0l", templateParams)
      .then((res) => console.log("Email sent successfully!", res.status))
      .catch((err) => console.log("Email notification skipped or error:", err));
  }

  // ==========================================================================
  // 3. Countdown Timer (04/04/2026 21:00)
  // ==========================================================================
  const countdownEl = document.getElementById("countdown");
  const tripDate = new Date(2026, 3, 4, 21, 0, 0); // Month is 0-indexed (3 = April)

  function updateCountdown() {
    if (!countdownEl) return;
    const now = new Date();
    const diff = tripDate - now;

    if (diff <= 0) {
      countdownEl.textContent = "Đến giờ xuất phát rồi! 🎒";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);

    countdownEl.textContent = `${days} ngày ${hours} giờ ${mins} phút nữa`;
  }
  updateCountdown();
  setInterval(updateCountdown, 1000 * 30);

  // ==========================================================================
  // 4. Interactive Leaflet Map
  // ==========================================================================
  function initLeafletMap() {
    const mapContainer = document.getElementById("leafletMap");
    if (!mapContainer || typeof L === "undefined") return;

    // Center of Ha Giang Karst Plateau
    map = L.map("leafletMap", {
      center: [23.15, 105.20],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Tile Layers
    const osmLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    });

    const cartoVoyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19
    });

    const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; Esri &mdash; High-res satellite',
      maxZoom: 18
    });

    // Default to OpenStreetMap for maximum speed and rock-solid reliability in Vietnam
    osmLayer.addTo(map);

    // Layer switcher control (Top-Right)
    L.control.layers({
      "🗺️ Bản đồ tiêu chuẩn (OSM)": osmLayer,
      "🎨 Bản đồ du lịch (CartoDB)": cartoVoyager,
      "🛰️ Vệ tinh địa hình (Esri)": esriSatellite
    }, null, { position: "topright" }).addTo(map);

    // Responsive map invalidateSize
    window.addEventListener("resize", () => {
      if (map) map.invalidateSize();
    });
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 250);

    // Draw Road Polylines from OSRM Data
    const dayColors = {
      day1: "#f97316", // Terracotta Orange
      day2: "#10b981", // Emerald Green
      day3: "#8b5cf6"  // Royal Violet
    };

    ["day1", "day2", "day3"].forEach((dayKey) => {
      const routeInfo = routes[dayKey];
      if (routeInfo && routeInfo.coordinates && routeInfo.coordinates.length > 0) {
        // Outline glow polyline
        const glowLine = L.polyline(routeInfo.coordinates, {
          color: dayColors[dayKey],
          weight: 8,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round"
        }).addTo(map);

        // Core polyline
        const poly = L.polyline(routeInfo.coordinates, {
          color: dayColors[dayKey],
          weight: 4.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round"
        }).addTo(map);

        mapLayers.polylines[dayKey] = {
          core: poly,
          glow: glowLine,
          bounds: poly.getBounds()
        };
      }
    });

    // Create Custom Markers for all Destinations
    destinations.forEach((dest) => {
      const dayClass = `pin-day${dest.day}`;

      const iconHtml = `
        <div class="pin-bubble ${dayClass}">
          <span>${dest.step}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-pin-marker",
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-img-wrap">
            <img src="${dest.image}" alt="${dest.name}" />
            <span class="popup-badge ${dayClass}">Ngày ${dest.day} • Điểm ${dest.step}</span>
          </div>
          <div class="popup-body">
            <div class="popup-title">${dest.name}</div>
            <div class="popup-sub">${dest.subtitle} (${dest.altitude})</div>
            <p class="popup-desc">${dest.desc}</p>
            <div class="popup-actions">
              <button class="popup-btn popup-btn-detail" onclick="window.scrollToDestCard('${dest.id}')">
                Chi tiết
              </button>
              <a class="popup-btn popup-btn-gmaps" target="_blank" rel="noopener noreferrer"
                 href="https://www.google.com/maps/search/?api=1&query=${dest.coords[0]},${dest.coords[1]}">
                Chỉ đường
              </a>
            </div>
          </div>
        </div>
      `;

      const marker = L.marker(dest.coords, { icon: customIcon })
        .bindPopup(popupHtml, { maxWidth: 280 })
        .addTo(map);

      marker.destData = dest;
      mapLayers.markers.push(marker);
      mapLayers.markerMap.set(dest.id, marker);

      marker.on("click", () => {
        highlightRailItem(dest.id);
      });
    });

    // Populate Waypoints Rail
    renderWaypointsRail(destinations);

    // Initial view fit
    fitMapToDay("all");
  }

  function fitMapToDay(dayKey) {
    if (!map) return;

    if (dayKey === "all") {
      const allBounds = L.latLngBounds([]);
      destinations.forEach((d) => allBounds.extend(d.coords));
      Object.values(mapLayers.polylines).forEach((p) => {
        if (p.bounds && p.bounds.isValid()) allBounds.extend(p.bounds);
      });
      if (allBounds.isValid()) {
        map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 12 });
      }
    } else {
      const dayBounds = L.latLngBounds([]);
      destinations.filter((d) => String(d.day) === String(dayKey)).forEach((d) => dayBounds.extend(d.coords));
      const p = mapLayers.polylines[`day${dayKey}`];
      if (p && p.bounds && p.bounds.isValid()) {
        dayBounds.extend(p.bounds);
      }
      if (dayBounds.isValid()) {
        map.fitBounds(dayBounds, { padding: [40, 40], maxZoom: 13 });
      }
    }
  }

  function filterMapByDay(day) {
    activeDayFilter = day;

    // Filter polylines visibility/opacity
    ["day1", "day2", "day3"].forEach((key) => {
      const p = mapLayers.polylines[key];
      if (!p) return;
      const dayNum = key.replace("day", "");
      if (day === "all" || day === dayNum) {
        p.core.setStyle({ opacity: 0.95, weight: 4.5 });
        p.glow.setStyle({ opacity: 0.35, weight: 8 });
      } else {
        p.core.setStyle({ opacity: 0.15, weight: 2.5 });
        p.glow.setStyle({ opacity: 0.05, weight: 4 });
      }
    });

    // Filter markers
    mapLayers.markers.forEach((m) => {
      const mDay = String(m.destData.day);
      if (day === "all" || day === mDay) {
        m.setOpacity(1);
      } else {
        m.setOpacity(0.35);
      }
    });

    // Filter Waypoints Rail
    const filteredDests = day === "all"
      ? destinations
      : destinations.filter((d) => String(d.day) === day);
    renderWaypointsRail(filteredDests);

    fitMapToDay(day);
  }

  // ==========================================================================
  // 5. Waypoints Rail Component
  // ==========================================================================
  function renderWaypointsRail(items) {
    const railList = document.getElementById("railList");
    const countBadge = document.getElementById("railCountBadge");
    if (!railList) return;

    if (countBadge) countBadge.textContent = `${items.length} điểm`;

    railList.innerHTML = items.map((dest) => `
      <div class="rail-item" data-id="${dest.id}" id="rail-${dest.id}">
        <img class="rail-item-thumb" src="${dest.image}" alt="${dest.name}" loading="lazy" />
        <div class="rail-item-info">
          <div class="rail-item-step">Điểm ${dest.step} • Ngày ${dest.day}</div>
          <div class="rail-item-title">${dest.name}</div>
          <div class="rail-item-meta">⛰️ ${dest.altitude} • ${dest.distance}</div>
        </div>
      </div>
    `).join("");

    // Add click listeners to rail items
    railList.querySelectorAll(".rail-item").forEach((el) => {
      el.addEventListener("click", () => {
        const destId = el.getAttribute("data-id");
        focusOnDestination(destId);
      });
    });
  }

  function highlightRailItem(destId) {
    document.querySelectorAll(".rail-item").forEach((el) => el.classList.remove("active"));
    const activeEl = document.getElementById(`rail-${destId}`);
    if (activeEl) {
      activeEl.classList.add("active");
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function focusOnDestination(destId) {
    const dest = destinations.find((d) => d.id === destId);
    if (!dest || !map) return;

    map.flyTo(dest.coords, 14, { duration: 1.2 });

    const marker = mapLayers.markerMap.get(destId);
    if (marker) {
      setTimeout(() => marker.openPopup(), 1250);
    }
    highlightRailItem(destId);
  }

  // Map Filter Buttons
  const mapFilterBtns = document.querySelectorAll("#mapDayFilters .map-tab-btn");
  mapFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      mapFilterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const day = btn.getAttribute("data-day");
      filterMapByDay(day);
    });
  });

  // Re-center Map Button
  const btnRecenter = document.getElementById("btnRecenterMap");
  btnRecenter?.addEventListener("click", () => {
    fitMapToDay(activeDayFilter);
  });

  // Graphic Map Toggle Button
  const btnToggleGraphic = document.getElementById("btnToggleGraphicMap");
  const staticMapView = document.getElementById("staticMapView");
  const graphicMapText = document.getElementById("graphicMapText");
  const graphicMapIcon = document.getElementById("graphicMapIcon");
  let isGraphicActive = false;

  btnToggleGraphic?.addEventListener("click", () => {
    isGraphicActive = !isGraphicActive;
    if (staticMapView) {
      staticMapView.classList.toggle("active", isGraphicActive);
    }
    if (graphicMapText && graphicMapIcon) {
      if (isGraphicActive) {
        graphicMapText.textContent = "Bản đồ tương tác";
        graphicMapIcon.textContent = "🗺️";
      } else {
        graphicMapText.textContent = "Xem ảnh bản đồ";
        graphicMapIcon.textContent = "🖼️";
      }
    }
  });

  // ==========================================================================
  // 6. Detailed 3-Day Itinerary Component
  // ==========================================================================
  let activeItinDay = 1;

  function renderItineraryDay(dayNumber) {
    activeItinDay = dayNumber;
    const dayData = itineraries.find((it) => it.day === dayNumber);
    if (!dayData) return;

    // Overview Card
    const overviewCard = document.getElementById("dayOverviewCard");
    if (overviewCard) {
      overviewCard.innerHTML = `
        <div class="day-overview-info">
          <h3>Ngày ${dayData.day}: ${dayData.title}</h3>
          <p>${dayData.subtitle}</p>
        </div>
        <div class="day-badges">
          <span class="day-badge-pill">📍 Quãng đường: <strong>${dayData.distance}</strong></span>
          <span class="day-badge-pill">⏱️ Thời gian: <strong>${dayData.ridingTime}</strong></span>
        </div>
      `;
    }

    // Timeline Stream
    const timelineStream = document.getElementById("timelineStream");
    if (timelineStream) {
      // Find matching destination photos & details
      const dayDests = destinations.filter((d) => d.day === dayNumber);

      timelineStream.innerHTML = dayData.schedule.map((item, idx) => {
        const isFood = !!item.isFood;
        const matchedDest = destinations.find((d) => d.id === item.destId) || dayDests.find((d) => item.spot.toLowerCase().includes(d.name.toLowerCase().split(" ")[0]));
        const spotImage = item.image || (matchedDest ? matchedDest.image : "assets/images/pho-co-dong-van.jpg");
        const destId = item.destId || (matchedDest ? matchedDest.id : "");
        const dotDayClass = dayNumber === 2 ? "day2-dot" : dayNumber === 3 ? "day3-dot" : "";

        if (isFood) {
          return `
            <div class="timeline-card food-stop">
              <div class="timeline-dot" title="Thưởng thức ẩm thực">
                🍽️
              </div>
              <div class="timeline-card-content">
                <img class="timeline-card-img" src="${spotImage}" alt="${item.spot}" loading="lazy" />
                <div class="timeline-card-details">
                  <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <span class="timeline-time-badge" style="color: #fbbf24">⏰ ${item.time}</span>
                    <span class="timeline-food-badge">🍲 ${item.mealType || "Bữa ăn đặc sản"}</span>
                  </div>
                  <div class="timeline-card-title">${item.spot}</div>
                  <p class="timeline-card-desc">${item.action}</p>
                  ${item.foodDetail ? `
                    <div class="timeline-food-detail">
                      <span style="font-size: 1.1rem;">💡</span>
                      <div><strong>Gợi ý quán & giá:</strong> ${item.foodDetail}</div>
                    </div>
                  ` : ""}
                  ${destId ? `
                    <div class="timeline-card-actions">
                      <button class="btn-sm-map" type="button" onclick="window.jumpToMapSpot('${destId}', ${dayNumber})" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;">
                        <span>📍</span> Xem vị trí trên Bản Đồ
                      </button>
                    </div>
                  ` : ""}
                </div>
              </div>
            </div>
          `;
        }

        return `
          <div class="timeline-card">
            <div class="timeline-dot ${dotDayClass}">
              ${idx + 1}
            </div>
            <div class="timeline-card-content">
              <img class="timeline-card-img" src="${spotImage}" alt="${item.spot}" loading="lazy" />
              <div class="timeline-card-details">
                <span class="timeline-time-badge">⏰ ${item.time}</span>
                <div class="timeline-card-title">${item.spot}</div>
                <p class="timeline-card-desc">${item.action}</p>
                <div class="timeline-card-actions">
                  ${destId ? `
                    <button class="btn-sm-map" type="button" onclick="window.jumpToMapSpot('${destId}', ${dayNumber})">
                      <span>📍</span> Xem trên Bản Đồ
                    </button>
                  ` : ""}
                  ${destId ? `
                    <button class="btn-sm-map" type="button" onclick="window.openLightboxByDestId('${destId}')" style="background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.2);">
                      <span>🔍</span> Xem ảnh
                    </button>
                  ` : ""}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Itinerary Day Selector Tabs
  const itinDayTabs = document.querySelectorAll("#itineraryDayTabs .day-tab-btn");
  itinDayTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      itinDayTabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const day = parseInt(btn.getAttribute("data-itin-day"), 10);
      renderItineraryDay(day);
    });
  });

  renderItineraryDay(1);

  // ==========================================================================
  // 7. Destinations & Photo Gallery Showcase
  // ==========================================================================
  function renderDestinationsGrid(category = "all") {
    const grid = document.getElementById("destinationsGrid");
    if (!grid) return;

    galleryImages.length = 0; // Clear array

    const filtered = category === "all"
      ? destinations
      : destinations.filter((d) => d.category === category);

    filtered.forEach((d) => {
      galleryImages.push({
        id: d.id,
        src: d.imageWide || d.image,
        title: d.name,
        subtitle: `${d.subtitle} • Độ cao ${d.altitude}`
      });
    });

    grid.innerHTML = filtered.map((d, index) => {
      const dayColorClass = `pin-day${d.day}`;
      return `
        <article class="dest-card" id="card-${d.id}">
          <div class="dest-card-media">
            <img src="${d.image}" alt="${d.name}" loading="lazy" />
            <div class="dest-card-overlay"></div>
            <span class="dest-card-badge ${dayColorClass}">Ngày ${d.day} • Điểm ${d.step}</span>
            <span class="dest-card-altitude">⛰️ ${d.altitude}</span>
          </div>
          <div class="dest-card-content">
            <div class="dest-card-header">
              <div>
                <h3 class="dest-card-title">${d.name}</h3>
                <div class="dest-card-subtitle">${d.subtitle}</div>
              </div>
            </div>
            <p class="dest-card-desc">${d.desc}</p>
            <div class="dest-card-highlight">
              💡 <strong>Mẹo check-in:</strong> ${d.tip}
            </div>
            <div class="dest-card-footer">
              <button class="btn-card-action" type="button" onclick="window.openLightbox(${index})">
                <span>🔍</span> Phóng to ảnh
              </button>
              <button class="btn-card-action" type="button" onclick="window.jumpToMapSpot('${d.id}', ${d.day})" style="color: var(--accent-orange)">
                <span>📍</span> Xem trên Bản đồ
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  // Gallery Filter Pills
  const galleryFilterPills = document.querySelectorAll("#galleryFilters .filter-pill");
  galleryFilterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      galleryFilterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.getAttribute("data-category");
      renderDestinationsGrid(cat);
    });
  });

  renderDestinationsGrid("all");

  // ==========================================================================
  // 8. Image Lightbox Modal
  // ==========================================================================
  const lightboxModal = document.getElementById("lightboxModal");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxSub = document.getElementById("lightboxSub");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");

  function openLightbox(index) {
    if (!galleryImages[index] || !lightboxModal) return;
    currentLightboxIndex = index;
    const item = galleryImages[index];

    lightboxImg.src = item.src;
    lightboxTitle.textContent = item.title;
    lightboxSub.textContent = item.subtitle;

    lightboxModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  function prevLightbox() {
    if (galleryImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + galleryImages.length) % galleryImages.length;
    openLightbox(currentLightboxIndex);
  }

  function nextLightbox() {
    if (galleryImages.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % galleryImages.length;
    openLightbox(currentLightboxIndex);
  }

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", prevLightbox);
  lightboxNext?.addEventListener("click", nextLightbox);

  lightboxModal?.addEventListener("click", (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightboxModal || !lightboxModal.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prevLightbox();
    if (e.key === "ArrowRight") nextLightbox();
  });

  // Global window functions for inline onclick handlers
  window.openLightbox = openLightbox;
  window.openLightboxByDestId = (destId) => {
    const idx = galleryImages.findIndex((img) => img.id === destId);
    if (idx !== -1) openLightbox(idx);
  };
  window.scrollToDestCard = (destId) => {
    const card = document.getElementById(`card-${destId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.borderColor = "var(--accent-orange)";
      setTimeout(() => (card.style.borderColor = ""), 2500);
    }
  };
  window.jumpToMapSpot = (destId, day) => {
    const mapSection = document.getElementById("mapSection");
    mapSection?.scrollIntoView({ behavior: "smooth" });

    // Switch map filter tab if needed
    if (day) {
      const dayBtn = document.querySelector(`#mapDayFilters .map-tab-btn[data-day="${day}"]`);
      if (dayBtn && !dayBtn.classList.contains("active")) {
        mapFilterBtns.forEach((b) => b.classList.remove("active"));
        dayBtn.classList.add("active");
        filterMapByDay(String(day));
      }
    }

    setTimeout(() => {
      focusOnDestination(destId);
    }, 600);
  };

  // ==========================================================================
  // 9. Local Cuisine Rendering
  // ==========================================================================
  function renderCuisines() {
    const cuisineGrid = document.getElementById("cuisineGrid");
    if (!cuisineGrid) return;

    cuisineGrid.innerHTML = cuisines.map((food) => `
      <div class="cuisine-card">
        ${food.image ? `
          <img class="cuisine-card-img" src="${food.image}" alt="${food.name}" loading="lazy" />
        ` : ""}
        <div class="cuisine-card-top">
          <h4 class="cuisine-title">${food.name}</h4>
          <span class="cuisine-price">${food.price}</span>
        </div>
        <div class="cuisine-time">⏰ ${food.time}</div>
        <div class="cuisine-place">📍 ${food.place}</div>
        <p class="cuisine-desc">${food.desc}</p>
      </div>
    `).join("");
  }
  renderCuisines();

  // ==========================================================================
  // 10. Playful RSVP & Funny Fleeing Button
  // ==========================================================================
  const btnYes = document.getElementById("btnYes");
  const btnNo = document.getElementById("btnNo");
  const rsvpArea = document.getElementById("rsvpArea");
  const rsvpMessage = document.getElementById("rsvpMessage");
  let escapedTimes = 0;

  function shootCelebrationConfetti() {
    if (typeof confetti !== "function") return;
    const colors = ["#f97316", "#10b981", "#fbbf24", "#8b5cf6", "#ffffff"];

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.65 },
      colors
    });

    setTimeout(() => {
      confetti({ particleCount: 90, angle: 60, spread: 60, origin: { x: 0.1, y: 0.7 }, colors });
      confetti({ particleCount: 90, angle: 120, spread: 60, origin: { x: 0.9, y: 0.7 }, colors });
    }, 250);
  }

  function handleYes() {
    shootCelebrationConfetti();
    if (rsvpMessage) {
      rsvpMessage.textContent = "🎉 Quá đã! Hà Giang đang đợi chúng ta. Lên đồ thôi nào!";
      rsvpMessage.style.color = "#34d399";
    }
    sendEmailNotification("Đồng ý đi Hà Giang", "Người dùng đã nhấn nút Đồng ý đi Hà Giang.");
  }

  btnYes?.addEventListener("click", handleYes);
  document.querySelectorAll(".js-yes, .js-scroll-rsvp").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("rsvpSection")?.scrollIntoView({ behavior: "smooth" });
      if (el.classList.contains("js-yes")) {
        handleYes();
      }
    });
  });

  function moveNoButton() {
    if (!btnNo || !rsvpArea) return;

    const areaRect = rsvpArea.getBoundingClientRect();
    const btnRect = btnNo.getBoundingClientRect();
    const yesRect = btnYes ? btnYes.getBoundingClientRect() : null;

    const maxX = areaRect.width - btnRect.width - 16;
    const maxY = areaRect.height - btnRect.height - 16;

    let nextX = 0;
    let nextY = 0;
    let attempts = 0;
    let overlap = true;

    while (overlap && attempts < 25) {
      nextX = Math.max(8, Math.floor(Math.random() * Math.max(16, maxX)));
      nextY = Math.max(8, Math.floor(Math.random() * Math.max(16, maxY)));

      if (!yesRect) {
        overlap = false;
        break;
      }

      const relYesX = yesRect.left - areaRect.left;
      const relYesY = yesRect.top - areaRect.top;
      const padding = 15;

      const isOverlapping = !(
        nextX + btnRect.width + padding < relYesX ||
        nextX > relYesX + yesRect.width + padding ||
        nextY + btnRect.height + padding < relYesY ||
        nextY > relYesY + yesRect.height + padding
      );

      if (!isOverlapping) overlap = false;
      attempts++;
    }

    btnNo.style.position = "absolute";
    btnNo.style.left = `${nextX}px`;
    btnNo.style.top = `${nextY}px`;
    btnNo.style.right = "auto";

    escapedTimes += 1;
    const teasing = [
      "No no, bắt không được đâu! 😜",
      "Bấm OK đi mà, đừng bấm Không nữa!",
      "Hà Giang đẹp lắm, không đi là tiếc cả đời đó!",
      "Thôi nào, mình năn nỉ thật lòng đấy 🥺",
      "Bạn mà bấm Không là mình buồn 3 ngày 3 đêm đó!",
      "Đến trẻ con Hà Giang còn đang vẫy tay gọi kìa! 🏔️"
    ];

    if (rsvpMessage) {
      rsvpMessage.textContent = teasing[Math.min(escapedTimes - 1, teasing.length - 1)];
      rsvpMessage.style.color = "#fb923c";
    }

    if (escapedTimes >= 8) {
      sendEmailNotification("Cố gắng từ chối", `Người dùng cố bấm Không ${escapedTimes} lần.`);
    }
  }

  btnNo?.addEventListener("mouseenter", moveNoButton);
  btnNo?.addEventListener("click", (e) => {
    e.preventDefault();
    moveNoButton();
  });
  btnNo?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    moveNoButton();
  });

  // ==========================================================================
  // 11. Ambient Chill Audio Experience (Web Audio API Synthesizer)
  // ==========================================================================
  const musicToggle = document.getElementById("musicToggle");
  const musicIcon = document.getElementById("musicIcon");
  const musicText = document.getElementById("musicText");
  let audioCtx = null;
  let isPlayingMusic = false;
  let synthTimer = null;

  // Gentle acoustic mountain pentatonic scales (D major pentatonic / highland breeze)
  const notesFreq = [
    293.66, // D4
    329.63, // E4
    369.99, // F#4
    440.00, // A4
    493.88, // B4
    587.33, // D5
    659.25, // E5
    739.99  // F#5
  ];

  function playPentatonicChime() {
    if (!audioCtx || !isPlayingMusic) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Warm triangle or sine wave reminiscent of bamboo flute / acoustic chime
      osc.type = Math.random() > 0.5 ? "sine" : "triangle";
      const randomNote = notesFreq[Math.floor(Math.random() * notesFreq.length)];
      osc.frequency.setValueAtTime(randomNote, audioCtx.currentTime);

      // Soft envelope attack & decay
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.035, audioCtx.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 2.9);
    } catch (e) {
      console.log("Audio synth error:", e);
    }

    if (isPlayingMusic) {
      const nextDelay = 1200 + Math.random() * 2200;
      synthTimer = setTimeout(playPentatonicChime, nextDelay);
    }
  }

  function toggleChillMusic() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }

    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    isPlayingMusic = !isPlayingMusic;

    if (isPlayingMusic) {
      if (musicIcon) musicIcon.textContent = "🔊";
      if (musicText) musicText.textContent = "Tắt nhạc chill";
      musicToggle?.classList.add("playing");
      playPentatonicChime();
    } else {
      if (musicIcon) musicIcon.textContent = "🎵";
      if (musicText) musicText.textContent = "Bật nhạc chill";
      musicToggle?.classList.remove("playing");
      if (synthTimer) clearTimeout(synthTimer);
    }
  }

  musicToggle?.addEventListener("click", toggleChillMusic);

  // ==========================================================================
  // 12. Mobile Menu Navigation
  // ==========================================================================
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");

  navToggle?.addEventListener("click", () => {
    navMenu?.classList.toggle("open");
  });

  navMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu?.classList.remove("open");
    });
  });

  // ==========================================================================
  // 13. Route Simulation Animation (🛵 Mô Phỏng Xe Chạy Dọc Tuyến)
  // ==========================================================================
  const btnSimulateRoute = document.getElementById("btnSimulateRoute");
  const simStatusBanner = document.getElementById("simStatusBanner");
  const simCurrentStop = document.getElementById("simCurrentStop");
  const simProgress = document.getElementById("simProgress");
  const btnStopSim = document.getElementById("btnStopSim");
  const simIcon = document.getElementById("simIcon");
  const simText = document.getElementById("simText");

  let simMarker = null;
  let simInterval = null;
  let isSimulating = false;
  let simStepIndex = 0;

  function stopRouteSimulation() {
    isSimulating = false;
    if (simInterval) clearInterval(simInterval);
    if (simMarker && map) {
      map.removeLayer(simMarker);
      simMarker = null;
    }
    if (simStatusBanner) simStatusBanner.classList.remove("active");
    if (simIcon) simIcon.textContent = "▶";
    if (simText) simText.textContent = "Mô phỏng xe chạy 🛵";
  }

  function startRouteSimulation() {
    if (!map || destinations.length === 0) return;
    isSimulating = true;
    simStepIndex = 0;

    // Reset filters to all days
    mapFilterBtns.forEach((b) => b.classList.remove("active"));
    const allBtn = document.querySelector('#mapDayFilters .map-tab-btn[data-day="all"]');
    allBtn?.classList.add("active");
    filterMapByDay("all");

    if (simStatusBanner) simStatusBanner.classList.add("active");
    if (simIcon) simIcon.textContent = "⏸";
    if (simText) simText.textContent = "Tạm dừng mô phỏng";

    // Create Motorbike Simulation Marker
    const motoIcon = L.divIcon({
      className: "sim-moto-marker-wrap",
      html: `<div class="sim-moto-marker">🛵</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const firstDest = destinations[0];
    simMarker = L.marker(firstDest.coords, { icon: motoIcon, zIndexOffset: 1000 }).addTo(map);

    function stepToNextWaypoint() {
      if (!isSimulating || simStepIndex >= destinations.length) {
        if (simCurrentStop) simCurrentStop.textContent = "🎉 Đã hoàn thành cung đường 440km tuyệt đẹp!";
        setTimeout(stopRouteSimulation, 3000);
        return;
      }

      const dest = destinations[simStepIndex];
      simMarker.setLatLng(dest.coords);
      map.panTo(dest.coords, { animate: true, duration: 1.2 });

      if (simCurrentStop) {
        simCurrentStop.textContent = `Ngày ${dest.day} • ${dest.name} (${dest.altitude})`;
      }
      if (simProgress) {
        simProgress.textContent = `Điểm ${dest.step} / ${dest.length || destinations.length}`;
      }

      highlightRailItem(dest.id);

      simStepIndex++;
    }

    stepToNextWaypoint();
    simInterval = setInterval(stepToNextWaypoint, 2600);
  }

  btnSimulateRoute?.addEventListener("click", () => {
    if (isSimulating) {
      stopRouteSimulation();
    } else {
      startRouteSimulation();
    }
  });

  btnStopSim?.addEventListener("click", stopRouteSimulation);

  // ==========================================================================
  // 14. Print / PDF Export Handler
  // ==========================================================================
  const btnPrintItinerary = document.getElementById("btnPrintItinerary");
  btnPrintItinerary?.addEventListener("click", () => {
    window.print();
  });

  // ==========================================================================
  // 15. Interactive Packing Checklist (with LocalStorage)
  // ==========================================================================
  const checklistData = [
    {
      category: "📄 Giấy Tờ & Tiền Mặt",
      items: [
        { id: "c1", label: "CCCD / Hộ chiếu bản gốc (làm thủ tục lưu trú & cực Bắc)" },
        { id: "c2", label: "Bằng lái xe máy hạng A1/A2 còn hạn" },
        { id: "c3", label: "Tiền mặt ~ 2 - 3 triệu (các bản làng ít có cây ATM)" }
      ]
    },
    {
      category: "🧥 Trang Phục & Giày Dép",
      items: [
        { id: "c4", label: "Áo khoác gió / Áo phao nhẹ (đêm cao nguyên nhiệt độ 12-16°C)" },
        { id: "c5", label: "Bộ áo mưa 2 mảnh rời (chống thấm gió khi qua đèo cao)" },
        { id: "c6", label: "Giày leo núi / thể thao có đế bám gai chống trượt" },
        { id: "c7", label: "Găng tay lái xe có gù bảo vệ ngón tay" },
        { id: "c8", label: "Khăn rằn / khăn len quàng cổ giữ ấm thanh quản" },
        { id: "c9", label: "Kính râm chống chói nắng & bụi đường" }
      ]
    },
    {
      category: "📱 Thiết Bị Điện Tử",
      items: [
        { id: "c10", label: "Sạc dự phòng 20.000mAh (trên đèo sóng yếu hao pin)" },
        { id: "c11", label: "Bao chống nước cảm ứng cho điện thoại" },
        { id: "c12", label: "Giá kẹp điện thoại chắc chắn gắn tay lái xe" },
        { id: "c13", label: "Camera hành trình / Gậy chụp ảnh selfie" }
      ]
    },
    {
      category: "💊 Y Tế & Chăm Sóc Sức Khỏe",
      items: [
        { id: "c14", label: "Thuốc chống say xe, đau đầu, hạ sốt khẩn cấp" },
        { id: "c15", label: "Thuốc tiêu hóa, men vi sinh, Oresol bù nước" },
        { id: "c16", label: "Băng cá nhân Urgo, gạc vô trùng & chai xịt côn trùng" }
      ]
    }
  ];

  function initPackingChecklist() {
    const columnsContainer = document.getElementById("checklistColumns");
    const progressFill = document.getElementById("checklistProgressFill");
    const progressText = document.getElementById("checklistProgressText");
    if (!columnsContainer) return;

    let savedState = {};
    try {
      savedState = JSON.parse(localStorage.getItem("hagiang_packing_checklist") || "{}");
    } catch (e) {
      savedState = {};
    }

    let totalItems = 0;
    checklistData.forEach((cat) => (totalItems += cat.items.length));

    function updateProgress() {
      const checkedCount = Object.values(savedState).filter(Boolean).length;
      const pct = Math.round((checkedCount / totalItems) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressText) {
        progressText.textContent = `Đã sẵn sàng ${checkedCount}/${totalItems} món (${pct}%)`;
      }
    }

    columnsContainer.innerHTML = checklistData.map((cat) => `
      <div class="checklist-col">
        <div class="checklist-category-title">${cat.category}</div>
        <div class="checklist-items-list">
          ${cat.items.map((item) => {
            const isChecked = !!savedState[item.id];
            return `
              <label class="checklist-item ${isChecked ? "checked" : ""}" data-item-id="${item.id}">
                <input type="checkbox" id="${item.id}" ${isChecked ? "checked" : ""} />
                <span>${item.label}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");

    // Add event listeners
    columnsContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const itemId = e.target.id;
        const parentLabel = e.target.closest(".checklist-item");
        savedState[itemId] = e.target.checked;
        if (parentLabel) {
          parentLabel.classList.toggle("checked", e.target.checked);
        }
        try {
          localStorage.setItem("hagiang_packing_checklist", JSON.stringify(savedState));
        } catch (err) {}
        updateProgress();
      });
    });

    updateProgress();
  }

  initPackingChecklist();

  // ==========================================================================
  // 16. Interactive Budget Estimator Component
  // ==========================================================================
  const calcPeople = document.getElementById("calcPeople");
  const calcTransportOpts = document.querySelectorAll("#calcTransportOptions .calc-pill-opt");
  const calcStayOpts = document.querySelectorAll("#calcStayOptions .calc-pill-opt");
  const calcFoodOpts = document.querySelectorAll("#calcFoodOptions .calc-pill-opt");

  const calcTotalPrice = document.getElementById("calcTotalPrice");
  const calcPerPerson = document.getElementById("calcPerPerson");
  const bdTransport = document.getElementById("bdTransport");
  const bdStay = document.getElementById("bdStay");
  const bdFood = document.getElementById("bdFood");
  const bdTickets = document.getElementById("bdTickets");

  let budgetState = {
    people: 2,
    transport: "bus-bike",
    stay: "homestay",
    food: "standard"
  };

  function formatVND(amount) {
    return amount.toLocaleString("vi-VN") + "đ";
  }

  function calculateBudget() {
    if (!calcTotalPrice) return;
    const people = budgetState.people;

    // Transport cost calculation per person
    let transportCost = 0;
    if (budgetState.transport === "bus-bike") {
      const bikesNeeded = Math.ceil(people / 2);
      const bikeAndGasTotal = bikesNeeded * (450000 + 150000);
      transportCost = 700000 + Math.round(bikeAndGasTotal / people);
    } else if (budgetState.transport === "motorbike-self") {
      const bikesNeeded = Math.ceil(people / 2);
      transportCost = Math.round((bikesNeeded * 550000) / people);
    } else if (budgetState.transport === "car-rental") {
      transportCost = 1800000;
    }

    // Accommodation cost per person (2 nights)
    let stayCost = 0;
    if (budgetState.stay === "homestay") {
      stayCost = 200000 * 2; // 400k/person
    } else if (budgetState.stay === "hotel") {
      const roomsNeeded = Math.ceil(people / 2);
      stayCost = Math.round((roomsNeeded * 900000) / people);
    } else if (budgetState.stay === "resort") {
      const roomsNeeded = Math.ceil(people / 2);
      stayCost = Math.round((roomsNeeded * 2800000) / people);
    }

    // Food cost per person (3 days)
    let foodCost = 0;
    if (budgetState.food === "economy") {
      foodCost = 200000 * 3; // 600k
    } else if (budgetState.food === "standard") {
      foodCost = 350000 * 3; // 1.050k
    } else if (budgetState.food === "deluxe") {
      foodCost = 550000 * 3; // 1.650k
    }

    // Sightseeing tickets & boat
    const ticketsCost = 175000; // Nho Que 120k + Vua Meo 20k + Lung Cu 25k + Nha Pao 10k

    const costPerPerson = transportCost + stayCost + foodCost + ticketsCost;
    const totalGroupCost = costPerPerson * people;

    calcTotalPrice.textContent = formatVND(totalGroupCost);
    calcPerPerson.textContent = `~ ${formatVND(costPerPerson)} / người (nhóm ${people} người)`;

    if (bdTransport) bdTransport.textContent = formatVND(transportCost) + "/người";
    if (bdStay) bdStay.textContent = formatVND(stayCost) + "/người";
    if (bdFood) bdFood.textContent = formatVND(foodCost) + "/người";
    if (bdTickets) bdTickets.textContent = formatVND(ticketsCost) + "/người";
  }

  calcPeople?.addEventListener("change", (e) => {
    budgetState.people = parseInt(e.target.value, 10) || 2;
    calculateBudget();
  });

  function setupOptionGroup(elements, stateKey) {
    elements.forEach((btn) => {
      btn.addEventListener("click", () => {
        elements.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        budgetState[stateKey] = btn.getAttribute(`data-${stateKey}`);
        calculateBudget();
      });
    });
  }

  setupOptionGroup(calcTransportOpts, "transport");
  setupOptionGroup(calcStayOpts, "stay");
  setupOptionGroup(calcFoodOpts, "food");

  calculateBudget();

  // ==========================================================================
  // 17. Initialize Map on Page Load
  // ==========================================================================
  initLeafletMap();
});

