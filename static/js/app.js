document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("csr-form");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = submitBtn.querySelector(".btn-text");
    const spinner = submitBtn.querySelector(".spinner");
    const errorContainer = document.getElementById("error-container");
    const resultsSection = document.getElementById("results-section");
    const csrOutput = document.getElementById("csr-output");
    const keyOutput = document.getElementById("key-output");
    const downloadCsrBtn = document.getElementById("download-csr-btn");
    const downloadKeyBtn = document.getElementById("download-key-btn");
    const resetBtn = document.getElementById("reset-btn");
    const addDnsBtn = document.getElementById("add-dns-btn");
    const addIpBtn = document.getElementById("add-ip-btn");
    const sanDnsList = document.getElementById("san-dns-list");
    const sanIpList = document.getElementById("san-ip-list");
    const countryInput = document.getElementById("country");

    let currentData = null;

    // Auto-uppercase country code
    countryInput.addEventListener("input", function () {
        this.value = this.value.toUpperCase();
    });

    // Add SAN fields
    addDnsBtn.addEventListener("click", function () {
        addSanField(sanDnsList, "dns", "ex: www.example.com");
    });

    addIpBtn.addEventListener("click", function () {
        addSanField(sanIpList, "ip", "ex: 192.168.1.1");
    });

    function addSanField(container, type, placeholder) {
        var entry = document.createElement("div");
        entry.className = "san-entry";

        var input = document.createElement("input");
        input.type = "text";
        input.name = "san_" + type + "[]";
        input.placeholder = placeholder;

        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-remove";
        removeBtn.textContent = "\u00D7";
        removeBtn.addEventListener("click", function () {
            entry.remove();
        });

        entry.appendChild(input);
        entry.appendChild(removeBtn);
        container.appendChild(entry);
        input.focus();
    }

    // Form submission
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        hideError();

        var data = collectFormData();
        var validationError = validateForm(data);
        if (validationError) {
            showError(validationError);
            return;
        }

        setLoading(true);

        fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })
            .then(function (response) {
                return response.json().then(function (body) {
                    return { status: response.status, body: body };
                });
            })
            .then(function (result) {
                setLoading(false);
                if (result.status !== 200) {
                    showError(result.body.error || "An error occurred");
                    return;
                }
                currentData = result.body;
                showResults(result.body);
            })
            .catch(function (err) {
                setLoading(false);
                showError("Network error: unable to reach the server.");
            });
    });

    function collectFormData() {
        var dnsInputs = sanDnsList.querySelectorAll("input");
        var ipInputs = sanIpList.querySelectorAll("input");

        var sanDns = [];
        dnsInputs.forEach(function (input) {
            if (input.value.trim()) sanDns.push(input.value.trim());
        });

        var sanIps = [];
        ipInputs.forEach(function (input) {
            if (input.value.trim()) sanIps.push(input.value.trim());
        });

        return {
            common_name: document.getElementById("common_name").value.trim(),
            organization: document.getElementById("organization").value.trim(),
            organizational_unit: document.getElementById("organizational_unit").value.trim(),
            locality: document.getElementById("locality").value.trim(),
            state: document.getElementById("state").value.trim(),
            country: document.getElementById("country").value.trim(),
            email: document.getElementById("email").value.trim(),
            key_size: parseInt(document.getElementById("key_size").value, 10),
            san_dns: sanDns,
            san_ips: sanIps,
        };
    }

    function validateForm(data) {
        if (!data.common_name) {
            return "Le Common Name (CN) est requis.";
        }
        if (!data.country || !/^[A-Z]{2}$/.test(data.country)) {
            return "Le code pays doit contenir exactement 2 lettres (ex: FR, US).";
        }
        if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
            return "L'adresse email n'est pas valide.";
        }
        for (var i = 0; i < data.san_ips.length; i++) {
            if (!isValidIP(data.san_ips[i])) {
                return "Adresse IP invalide : " + data.san_ips[i];
            }
        }
        return null;
    }

    function isValidIP(str) {
        // IPv4
        var ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        var match = str.match(ipv4);
        if (match) {
            for (var i = 1; i <= 4; i++) {
                if (parseInt(match[i], 10) > 255) return false;
            }
            return true;
        }
        // IPv6 (basic check)
        if (str.indexOf(":") !== -1 && /^[0-9a-fA-F:]+$/.test(str)) {
            return true;
        }
        return false;
    }

    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.hidden = false;
        errorContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function hideError() {
        errorContainer.hidden = true;
        errorContainer.textContent = "";
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.textContent = loading ? "Generation en cours..." : "Generer le CSR";
        spinner.hidden = !loading;
    }

    function showResults(data) {
        form.hidden = true;
        resultsSection.hidden = false;
        csrOutput.value = data.csr;
        keyOutput.value = data.private_key;
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Download buttons
    downloadCsrBtn.addEventListener("click", function () {
        if (currentData) {
            downloadFile(currentData.csr, currentData.common_name + ".csr");
        }
    });

    downloadKeyBtn.addEventListener("click", function () {
        if (currentData) {
            downloadFile(currentData.private_key, currentData.common_name + ".key");
        }
    });

    function downloadFile(content, filename) {
        var blob = new Blob([content], { type: "application/x-pem-file" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Reset button
    resetBtn.addEventListener("click", function () {
        currentData = null;
        form.reset();
        resultsSection.hidden = true;
        form.hidden = false;
        sanDnsList.innerHTML = "";
        sanIpList.innerHTML = "";
        hideError();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});
