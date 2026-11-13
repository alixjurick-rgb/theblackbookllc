(function () {
  document.documentElement.classList.add("js");

  var header = document.querySelector("header.site");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
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
    select.value = link.getAttribute("data-select-service") || "";
  });

  var form = document.getElementById("consult-form");
  var status = document.getElementById("form-status");
  var sendBtn = document.getElementById("send");
  if (!form || !status || !sendBtn) return;

  var SPACE_VALUES = [
    "Closet",
    "Kitchen & pantry",
    "Bathroom",
    "Home office",
    "Kids' room / playroom",
    "Linen or utility closet"
  ];
  var TIMELINE_VALUES = ["Within 2 weeks", "This month", "Just exploring"];

  function fieldValue(id) {
    return document.getElementById(id).value.trim();
  }

  function checkedValues(name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      function (input) { return input.value; }
    );
  }

  function statusFor(field) {
    if (field === "message") return "Please shorten your note and try again.";
    if (field === "zip") return "Please enter a 5-digit ZIP code.";
    if (field === "spaces") return "Please choose at least one space.";
    if (field === "timeline") return "Please select a timeline.";
    if (field === "form") return "Please check the form and try again.";
    return "Please add your name and a valid email so we can reply.";
  }

  function clearInvalid() {
    Array.prototype.forEach.call(form.querySelectorAll("[aria-invalid='true']"), function (el) {
      el.removeAttribute("aria-invalid");
    });
    Array.prototype.forEach.call(form.querySelectorAll(".is-invalid"), function (el) {
      el.classList.remove("is-invalid");
    });
  }

  function fail(field, el) {
    status.textContent = statusFor(field);
    if (el) {
      el.setAttribute("aria-invalid", "true");
      var wrap = el.closest(".field");
      if (wrap) wrap.classList.add("is-invalid");
      el.focus();
    }
  }

  var zipInput = document.getElementById("f-zip");
  if (zipInput) {
    zipInput.addEventListener("input", function () {
      var digits = zipInput.value.replace(/\D/g, "").slice(0, 5);
      if (zipInput.value !== digits) zipInput.value = digits;
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (sendBtn.disabled) return;
    clearInvalid();
    var name = fieldValue("f-name");
    var email = fieldValue("f-email");
    var zip = fieldValue("f-zip");
    var spaces = checkedValues("spaces").filter(function (value) {
      return SPACE_VALUES.indexOf(value) !== -1;
    });
    var timeline = checkedValues("timeline")[0] || "";
    var message = fieldValue("f-msg");
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail("email", document.getElementById(name ? "f-email" : "f-name"));
      return;
    }
    if (!/^\d{5}$/.test(zip)) {
      fail("zip", zipInput);
      return;
    }
    if (!spaces.length) {
      fail("spaces", form.querySelector('input[name="spaces"]'));
      return;
    }
    if (TIMELINE_VALUES.indexOf(timeline) === -1) {
      fail("timeline", form.querySelector('input[name="timeline"]'));
      return;
    }
    if (message.length > 4000) {
      fail("message", document.getElementById("f-msg"));
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
        zip: zip,
        neighborhood: fieldValue("f-town"),
        spaces: spaces,
        timeline: timeline,
        service: fieldValue("f-svc"),
        heard: (document.getElementById("f-hear") || { value: "" }).value.trim(),
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
        ["f-name", "f-email", "f-phone", "f-zip", "f-msg", "bbl-hp"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        document.getElementById("f-town").value = "";
        document.getElementById("f-svc").value = "";
        var hear = document.getElementById("f-hear");
        if (hear) hear.value = "";
        Array.prototype.forEach.call(form.querySelectorAll('input[name="spaces"], input[name="timeline"]'), function (input) {
          input.checked = false;
        });
        status.textContent = "";
        window.location.assign("/thank-you");
      } else if (result.data && result.data.error === "validation") {
        var field = result.data.field;
        var target = field === "zip" ? zipInput
          : field === "spaces" ? form.querySelector('input[name="spaces"]')
          : field === "timeline" ? form.querySelector('input[name="timeline"]')
          : field === "message" ? document.getElementById("f-msg")
          : document.getElementById("f-name");
        fail(field, target);
      } else {
        status.textContent = "We could not send your request. Please try again in a moment.";
      }
    }).catch(function () {
      status.textContent = "We could not send your request. Please try again in a moment.";
    }).then(function () {
      sendBtn.disabled = false;
    });
  });
})();
