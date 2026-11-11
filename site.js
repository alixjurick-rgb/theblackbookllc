(function () {
  document.documentElement.classList.add("js");

  var header = document.querySelector("header.site");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  var panel = document.querySelector(".form-panel");
  var success = panel ? panel.querySelector(".form-success") : null;

  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var year = document.getElementById("yr");
  if (year) year.textContent = new Date().getFullYear();

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  function setMenu(open) {
    if (!toggle || !header) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    var label = toggle.querySelector(".nav-toggle-label");
    if (label) label.textContent = open ? "Close" : "Menu";
    header.classList.toggle("nav-open", open);
    document.body.classList.toggle("nav-open", open);
  }

  if (toggle && nav && header) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });
    document.addEventListener("click", function (event) {
      if (!header.classList.contains("nav-open")) return;
      if (header.contains(event.target)) return;
      setMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setMenu(false);
    });
  }

  var contact = document.getElementById("contact");
  if (contact && "IntersectionObserver" in window) {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        document.body.classList.toggle("form-in-view", entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: "0px 0px -72px 0px" });
    barObserver.observe(contact);
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[data-select-service]");
    if (!link) return;
    var select = document.getElementById("f-svc");
    if (!select) return;
    if (panel && panel.classList.contains("is-sent")) {
      panel.classList.remove("is-sent");
      if (success) success.hidden = true;
    }
    select.value = link.getAttribute("data-select-service") || "";
  });

  var form = panel ? panel.querySelector(".form") : null;
  var status = document.getElementById("form-status");
  var sendBtn = document.getElementById("send");
  if (!form || !status || !sendBtn) return;

  function fieldValue(id) {
    return document.getElementById(id).value.trim();
  }

  function statusFor(field) {
    if (field === "message") return "Please shorten your note and try again.";
    if (field === "form") return "Please check the form and try again.";
    return "Please add your name and a valid email so we can reply.";
  }

  form.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener("click", function () {
    if (sendBtn.disabled) return;
    var name = fieldValue("f-name");
    var email = fieldValue("f-email");
    var message = fieldValue("f-msg");
    if (!name || !email || email.indexOf("@") < 1 || email.indexOf(".") < 0) {
      status.textContent = statusFor("email");
      return;
    }
    if (message.length > 4000) {
      status.textContent = statusFor("message");
      return;
    }
    sendBtn.disabled = true;
    status.textContent = "Sending your request…";
    fetch("/api/consult", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: fieldValue("f-phone"),
        neighborhood: fieldValue("f-town"),
        service: fieldValue("f-svc"),
        message: message,
        bbl_hp: (document.getElementById("bbl-hp").value || "").trim()
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      }, function () {
        return { ok: false, data: {} };
      });
    }).then(function (result) {
      if (result.ok && result.data && result.data.ok) {
        ["f-name", "f-email", "f-phone", "f-msg", "bbl-hp"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        document.getElementById("f-town").value = "";
        document.getElementById("f-svc").value = "";
        status.textContent = "";
        if (panel) panel.classList.add("is-sent");
        if (success) {
          success.hidden = false;
          success.focus();
        }
      } else if (result.data && result.data.error === "validation") {
        status.textContent = statusFor(result.data.field);
      } else {
        status.textContent = "We could not send your request. Please try again in a moment.";
      }
    }).catch(function () {
      status.textContent = "We could not send your request. Please try again in a moment.";
    }).then(function () {
      sendBtn.disabled = false;
    });
  });

  var another = document.getElementById("another");
  if (another) {
    another.addEventListener("click", function () {
      if (panel) panel.classList.remove("is-sent");
      if (success) success.hidden = true;
      status.textContent = "";
      var nameField = document.getElementById("f-name");
      if (nameField) nameField.focus();
    });
  }
})();
