# CSR Generator

Plateforme web pour la generation de Certificate Signing Requests (CSR) dans le domaine de la PKI.

## Fonctionnalites

- Generation de CSR avec tous les champs standards (CN, O, OU, L, ST, C, Email)
- Support des cles RSA 2048 et 4096 bits
- Support des Subject Alternative Names (DNS et IP)
- Telechargement des fichiers CSR (.csr) et cle privee (.key)
- Interface web moderne et responsive
- La cle privee n'est jamais stockee cote serveur

## Pre-requis

- Docker et Docker Compose

## Deploiement avec Docker

```bash
# Construire et demarrer le conteneur
docker compose up --build -d

# Verifier que le conteneur tourne
docker compose ps

# Voir les logs
docker compose logs -f
```

L'application est accessible sur **http://localhost:5000**

## Arret

```bash
docker compose down
```

## Developpement local (sans Docker)

```bash
# Installer les dependances
pip install -r requirements.txt

# Lancer l'application
python app.py
```

## Stack technique

- **Backend** : Python 3.12 + Flask + cryptography
- **Frontend** : HTML / CSS / JavaScript (vanilla)
- **Deploiement** : Docker + Docker Compose
