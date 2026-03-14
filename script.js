const countdownEl = document.getElementById("countdown");
const thinkBtn = document.getElementById("thinkBtn");
const finalNo = document.getElementById("finalNo");
const finalYes = document.getElementById("finalYes");
const finalArea = document.getElementById("finalArea");
const finalMessage = document.getElementById("finalMessage");
const yesButtons = document.querySelectorAll(".js-yes");
const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");

let musicReady = false;
let escapedTimes = 0;

// Initialize EmailJS with a placeholder Public Key
// User should replace 'YOUR_PUBLIC_KEY' with their actual key from EmailJS
(function () {
  if (window.emailjs) {
    emailjs.init({
      publicKey: "9Ag3UXn7NkkimDQJB",
    });
  }
})();


function sendNotification(status, details = "") {
  console.log(`Email simulation: ${status} ${details}`);

  if (!window.emailjs) return;

  const templateParams = {
    status: status,
    details: details,
    time: new Date().toLocaleString(),
    // Providing multiple keys to ensure compatibility with different EmailJS templates
    to_email: "iamhai.dev@gmail.com",
    user_email: "iamhai.dev@gmail.com",
    email: "iamhai.dev@gmail.com"
  };

  // Note: These IDs are placeholders. User needs to set up Service and Template in EmailJS.
  emailjs.send('service_yd1pq4a', 'template_yvjwx0l', templateParams)
    .then(function (response) {
      console.log('Email sent successfully!', response.status, response.text);
    }, function (error) {
      console.log('Email failed to send...', error);
      // Helpful tip for the user if it still fails
      if (error.status === 422) {
        console.warn("TIP: Check your EmailJS dashboard. Ensure the 'To Email' field in your template uses {{to_email}}, {{user_email}}, or {{email}}.");
      }
    });
}


function getNextTripDate() {
  // Chốt ngày đi là tối 4/4/2026 lúc 21:00
  return new Date(2026, 3, 4, 21, 0, 0);
}

const tripDate = getNextTripDate();

function updateCountdown() {
  const now = new Date();
  const diff = tripDate - now;

  if (diff <= 0) {
    countdownEl.textContent = "Đến giờ xuất phát rồi!";
    return;
  }

  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hour = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const min = Math.floor((diff / (1000 * 60)) % 60);

  countdownEl.textContent = `${day} ngày ${hour} giờ ${min} phút nữa đi!`;
}

updateCountdown();
setInterval(updateCountdown, 1000 * 30);

thinkBtn?.addEventListener("click", () => {
  document.getElementById("reasons")?.scrollIntoView({ behavior: "smooth" });
});

function shootConfetti() {
  if (typeof confetti !== "function") {
    return;
  }

  const colors = ["#d84f35", "#f3a447", "#4f9e90", "#ffffff"];

  confetti({
    particleCount: 110,
    spread: 70,
    startVelocity: 36,
    origin: { y: 0.7 },
    colors
  });

  setTimeout(() => {
    confetti({
      particleCount: 90,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.68 },
      colors
    });

    confetti({
      particleCount: 90,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.68 },
      colors
    });
  }, 220);
}

function celebrate(message) {
  shootConfetti();
  finalMessage.textContent = message;
  document.getElementById("final")?.scrollIntoView({ behavior: "smooth" });
}

yesButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    celebrate("Quá đã! Hà Giang đang đợi chúng ta.");
    sendNotification("Đồng ý đi Hà Giang", "Người dùng đã nhấn nút Đồng ý.");
  });
});



function moveNoButton() {
  if (!finalNo || !finalArea) {
    return;
  }

  const containerRect = finalArea.getBoundingClientRect();
  const btnRect = finalNo.getBoundingClientRect();

  const maxX = containerRect.width - btnRect.width - 12;
  const maxY = containerRect.height - btnRect.height - 12;

  let nextX, nextY;
  let overlap = true;
  let attempts = 0;

  // Lấy vị trí nút Yes để tránh đè lên
  const yesRect = finalYes ? finalYes.getBoundingClientRect() : null;
  const containerOffset = finalArea.getBoundingClientRect();

  while (overlap && attempts < 20) {
    nextX = Math.max(8, Math.floor(Math.random() * Math.max(16, maxX)));
    nextY = Math.max(8, Math.floor(Math.random() * Math.max(16, maxY)));

    if (!yesRect) {
      overlap = false;
      break;
    }

    // Tính toán vị trí tương đối của Yes trong container
    const relativeYesX = yesRect.left - containerOffset.left;
    const relativeYesY = yesRect.top - containerOffset.top;

    // Kiểm tra xem vị trí mới có đè lên nút Yes không (có padding an toàn)
    const padding = 10;
    const isOverlapping = !(
      nextX + btnRect.width + padding < relativeYesX ||
      nextX > relativeYesX + yesRect.width + padding ||
      nextY + btnRect.height + padding < relativeYesY ||
      nextY > relativeYesY + yesRect.height + padding
    );

    if (!isOverlapping) {
      overlap = false;
    }
    attempts++;
  }

  finalNo.style.left = `${nextX}px`;
  finalNo.style.top = `${nextY}px`;
  finalNo.style.right = "auto";

  escapedTimes += 1;
  const teasing = [
    "No no, bắt không được đâu.",
    "Bấm OK đi mà, đừng bấm Không nữa.",
    "Hà Giang đẹp lắm, đừng từ chối mà.",
    "Thôi nào, mình năn nỉ thật lòng đấy.",
    "Bạn mà bấm Không là mình buồn 3 ngày đó."
  ];

  finalMessage.textContent = teasing[Math.min(escapedTimes - 1, teasing.length - 1)];
}

finalNo?.addEventListener("mouseenter", moveNoButton);
finalNo?.addEventListener("click", (event) => {
  event.preventDefault();
  moveNoButton();

  if (escapedTimes >= 10) {
    sendNotification("Cố gắng từ chối", `Người dùng đã cố nhấn nút Không ${escapedTimes} lần nhưng không thành công.`);
  }
});

// Thêm touchstart để bắt ngay khi chạm trên điện thoại
finalNo?.addEventListener("touchstart", (event) => {
  event.preventDefault();
  moveNoButton();
});


function setupReveal() {
  const revealEls = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealEls.forEach((el, idx) => {
    el.style.transitionDelay = `${Math.min(280, idx * 25)}ms`;
    observer.observe(el);
  });
}

setupReveal();

function toggleMusic() {
  if (!bgMusic || !musicToggle) {
    return;
  }

  if (!musicReady) {
    bgMusic.volume = 0.45;
    musicReady = true;
  }

  if (bgMusic.paused) {
    bgMusic
      .play()
      .then(() => {
        musicToggle.textContent = "Tắt nhạc chill";
      })
      .catch(() => {
        musicToggle.textContent = "Nháy để bật nhạc";
      });
  } else {
    bgMusic.pause();
    musicToggle.textContent = "Bật nhạc chill";
  }
}

musicToggle?.addEventListener("click", toggleMusic);


