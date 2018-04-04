(function() {
    // reddit links
    document.querySelectorAll(".reddit-user").forEach(function(lnk) {
        var username = lnk.getAttribute("data-user");

        lnk.href = "http://reddit.com/u/" + username;
        lnk.innerHTML = "/u/" + username;
        lnk.target = "_blank";
    });
})();