{pkgs}: {
  deps = [
    # Python and package management (slim)
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.python311Packages.setuptools
    pkgs.python311Packages.wheel

    # SSL/TLS support for API calls
    pkgs.openssl
    pkgs.cacert

    # Database client library only (no server)
    pkgs.libpq

    # Image processing libs for Pillow/pdf2image
    pkgs.libjpeg
    pkgs.libpng
    pkgs.zlib
    pkgs.poppler_utils
  ];
  
  # Environment variables for the Nix environment
  env = {
    PYTHONPATH = "$REPL_HOME";
    PYTHONUNBUFFERED = "1";
    PIP_DISABLE_PIP_VERSION_CHECK = "1";
    PIP_NO_CACHE_DIR = "1";
    
    # SSL certificate path for secure connections
    SSL_CERT_FILE = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
    
    # PostgreSQL library path
    LD_LIBRARY_PATH = "${pkgs.libpq}/lib:${pkgs.openssl.out}/lib";
  };
}