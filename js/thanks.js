// Auto redirect after 10 seconds
document.addEventListener('DOMContentLoaded', function() {
  var seconds = 10;
  var timer = document.getElementById('timer');
  var interval = setInterval(function() {
    seconds--;
    if (timer) timer.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(interval);
      window.location.href = 'index.html';
    }
  }, 1000);
});
