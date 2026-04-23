// Location map switcher
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.location-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.location-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var loc = tab.dataset.location;
      document.getElementById('map-factory').style.display = loc === 'factory' ? 'block' : 'none';
      var officeMap = document.getElementById('map-office');
      officeMap.style.display = loc === 'office' ? 'block' : 'none';
      if (loc === 'office' && !officeMap.getAttribute('src')) {
        officeMap.setAttribute('src', officeMap.dataset.src);
      }
    });
  });
});
