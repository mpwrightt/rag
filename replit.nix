{pkgs}: {
  deps = [
    # Python and package management
    pkgs.python311Full
    pkgs.python311Packages.pip
    pkgs.python311Packages.setuptools
    pkgs.python311Packages.wheel
    
    # SSL/TLS support for API calls
    pkgs.openssl
    pkgs.cacert
    
    # Database connection libraries
    pkgs.postgresql
    pkgs.libpq
    
    # Image processing (if needed for document processing)
    pkgs.libjpeg
    pkgs.libpng
    pkgs.zlib
    
    # System utilities
    pkgs.curl
    pkgs.wget
    pkgs.git
    
    # Build tools for Python packages
    pkgs.gcc
    pkgs.gnumake
    pkgs.pkg-config
    
    # For Neo4j driver and graph operations
    pkgs.cyrus_sasl
    
    # Node.js (in case any Python packages need node)
    pkgs.nodejs_20
    pkgs.nodePackages.npm
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