document.addEventListener("DOMContentLoaded", function () {
  const voteButtons = document.querySelectorAll(".vote-btn");

  voteButtons.forEach(button => {
    button.addEventListener("click", function () {
      const bandId = button.dataset.band;
      const bandName = button.dataset.name;
      const voteKey = "bandtroductions_vote_" + bandId;
      const message = document.getElementById("vote-message-" + bandId);

      if (localStorage.getItem(voteKey)) {
        message.textContent = "You already voted for " + bandName + " on this device. 🤘";
        return;
      }

      localStorage.setItem(voteKey, "true");
      message.textContent = "Vote counted for " + bandName + "! 🤘";
      button.textContent = "Voted 🤘";
      button.disabled = true;
    });
  });
});
