import ipaddress
import re

from flask import Flask, render_template, request, jsonify
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

app = Flask(__name__)

ALLOWED_KEY_SIZES = (2048, 4096)
COUNTRY_RE = re.compile(r'^[A-Z]{2}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
HOSTNAME_RE = re.compile(r'^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$')


def validate_input(data):
    """Validate and clean the input data. Returns (cleaned_data, error_message)."""
    if not isinstance(data, dict):
        return None, "Invalid request body"

    common_name = (data.get("common_name") or "").strip()
    if not common_name or len(common_name) > 255:
        return None, "Common Name (CN) is required and must be at most 255 characters"

    country = (data.get("country") or "").strip().upper()
    if not COUNTRY_RE.match(country):
        return None, "Country must be a 2-letter ISO code (e.g., FR, US, DE)"

    key_size = data.get("key_size")
    try:
        key_size = int(key_size)
    except (TypeError, ValueError):
        return None, "Key size must be 2048 or 4096"
    if key_size not in ALLOWED_KEY_SIZES:
        return None, "Key size must be 2048 or 4096"

    organization = (data.get("organization") or "").strip()[:255]
    organizational_unit = (data.get("organizational_unit") or "").strip()[:255]
    locality = (data.get("locality") or "").strip()[:255]
    state = (data.get("state") or "").strip()[:255]

    email = (data.get("email") or "").strip()
    if email and not EMAIL_RE.match(email):
        return None, "Invalid email address format"

    san_dns = data.get("san_dns") or []
    if not isinstance(san_dns, list):
        return None, "san_dns must be a list"
    for name in san_dns:
        name = name.strip()
        if name and not HOSTNAME_RE.match(name):
            return None, f"Invalid DNS name: {name}"

    san_ips = data.get("san_ips") or []
    if not isinstance(san_ips, list):
        return None, "san_ips must be a list"
    for ip_str in san_ips:
        ip_str = ip_str.strip()
        if ip_str:
            try:
                ipaddress.ip_address(ip_str)
            except ValueError:
                return None, f"Invalid IP address: {ip_str}"

    cleaned = {
        "common_name": common_name,
        "country": country,
        "key_size": key_size,
        "organization": organization,
        "organizational_unit": organizational_unit,
        "locality": locality,
        "state": state,
        "email": email,
        "san_dns": [s.strip() for s in san_dns if s.strip()],
        "san_ips": [s.strip() for s in san_ips if s.strip()],
    }
    return cleaned, None


def generate_csr(params):
    """Generate a CSR and private key. Returns (csr_pem, key_pem) as strings."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=params["key_size"],
    )

    name_attrs = [
        x509.NameAttribute(NameOID.COMMON_NAME, params["common_name"]),
        x509.NameAttribute(NameOID.COUNTRY_NAME, params["country"]),
    ]
    if params["organization"]:
        name_attrs.append(x509.NameAttribute(NameOID.ORGANIZATION_NAME, params["organization"]))
    if params["organizational_unit"]:
        name_attrs.append(x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, params["organizational_unit"]))
    if params["locality"]:
        name_attrs.append(x509.NameAttribute(NameOID.LOCALITY_NAME, params["locality"]))
    if params["state"]:
        name_attrs.append(x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, params["state"]))
    if params["email"]:
        name_attrs.append(x509.NameAttribute(NameOID.EMAIL_ADDRESS, params["email"]))

    subject = x509.Name(name_attrs)
    builder = x509.CertificateSigningRequestBuilder().subject_name(subject)

    san_entries = []
    dns_names = list(params["san_dns"])
    if dns_names and params["common_name"] not in dns_names:
        dns_names.insert(0, params["common_name"])
    for dns_name in dns_names:
        san_entries.append(x509.DNSName(dns_name))
    for ip_str in params["san_ips"]:
        san_entries.append(x509.IPAddress(ipaddress.ip_address(ip_str)))

    if san_entries:
        builder = builder.add_extension(
            x509.SubjectAlternativeName(san_entries),
            critical=False,
        )

    csr = builder.sign(private_key, hashes.SHA256())

    key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode("utf-8")

    return csr_pem, key_pem


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    params, error = validate_input(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        csr_pem, key_pem = generate_csr(params)
    except Exception:
        return jsonify({"error": "Failed to generate CSR. Please check your inputs."}), 500

    return jsonify({
        "csr": csr_pem,
        "private_key": key_pem,
        "common_name": params["common_name"],
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
