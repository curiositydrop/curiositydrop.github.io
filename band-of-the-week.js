import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyApLiiJsKTw1Fp8J3aQatMqiSZoP_6EycE",
  authDomain: "bandfanwall.firebaseapp.com",
  databaseURL: "https://bandfanwall-default-rtdb.firebaseio.com",
  projectId: "bandfanwall",
  storageBucket: "bandfanwall.firebasestorage.app",
  messagingSenderId: "619241154826",
  appId: "1:619241154826:web:25ddc58eef094e3c0732f3"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const bandsRef = ref(db, "Bands");

const bandInfo = {
  "burning-time": {
    name: "Burning Time",
    meta: "Rock / Metal • Maine",
    image: "IMG_9383.jpeg",
    link: "burning-time.html"
  }
};

onValue(bandsRef, (snapshot) => {
  const data = snapshot.val();

  if (!data) return;

  const rankedBands = Object.entries(data)
    .map(([id, bandData]) => {
      const votes = bandData.votes || 0;
      const likes = bandData.likes || 0;
      const views = bandData.analytics?.views || 0;
      const supportClicks = bandData.analytics?.supportClicks || 0;
      const shareClicks = bandData.analytics?.shareClicks || 0;

      const score =
        (votes * 5) +
        (likes * 2) +
        (supportClicks * 10) +
        (shareClicks * 4) +
        (views * 0.25);

      return {
        id,
        votes,
        likes,
        views,
        supportClicks,
        shareClicks,
        score,
        info: bandInfo[id] || {
          name: id,
          meta: "Local Band",
          image: "IMG_9383.jpeg",
          link: "#"
        }
      };
    })
    .sort((a, b) => b.score - a.score);

  const winner = rankedBands[0];

  if (!winner) return;

  document.getElementById("currentWinnerName").textContent = winner.info.name;
  document.getElementById("currentWinnerMeta").textContent = winner.info.meta;
  document.getElementById("currentWinnerVotes").textContent =
    `${winner.votes} votes • ${winner.likes} likes • ${winner.views} views • Score: ${Math.round(winner.score)}`;

  document.getElementById("currentWinnerLink").href = winner.info.link;

  const img = document.querySelector("#currentWinnerCard img");
  if (img) {
    img.src = winner.info.image;
    img.alt = winner.info.name;
  }

  const leaderboard = document.getElementById("botwLeaderboard");

  if (leaderboard) {
    leaderboard.innerHTML = "";

    rankedBands.forEach((band, index) => {
      const row = document.createElement("div");
      row.className = "botw-winner";

      row.innerHTML = `
        <img src="${band.info.image}" alt="${band.info.name}">
        <div>
          <h3>#${index + 1} ${band.info.name}</h3>
          <p>${band.info.meta}</p>
          <p>${band.votes} votes • ${band.likes} likes • ${band.views} views</p>
          <p>🔥 Score: ${Math.round(band.score)}</p>
          <div class="band-links">
            <a class="button" href="${band.info.link}">View Band</a>
          </div>
        </div>
      `;

      leaderboard.appendChild(row);
    });
  }
});
