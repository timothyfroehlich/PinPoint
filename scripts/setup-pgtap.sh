#!/bin/bash

# Setup pgTAP Testing Framework
# Part of dual-track testing strategy for RLS validation

set -e

echo "🧪 Setting up pgTAP testing framework..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Detect OS and package manager
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get >/dev/null 2>&1; then
            echo "ubuntu"
        elif command -v yum >/dev/null 2>&1; then
            echo "centos"
        else
            echo "linux"
        fi
    else
        echo "unknown"
    fi
}

# Install pgTAP extension
install_pgtap() {
    local os=$(detect_os)
    
    echo "Detected OS: $os"
    
    case $os in
        "macos")
            if command -v brew >/dev/null 2>&1; then
                print_status "Installing pgTAP via Homebrew..."
                brew install pgtap
            else
                print_error "Homebrew not found. Please install Homebrew first."
                exit 1
            fi
            ;;
        "ubuntu")
            print_status "Installing pgTAP via apt..."
            sudo apt-get update
            sudo apt-get install -y postgresql-contrib postgresql-15-pgtap
            ;;
        "centos")
            print_status "Installing pgTAP via yum..."
            sudo yum install -y epel-release
            sudo yum install -y pgtap
            ;;
        *)
            print_warning "Unsupported OS. Please install pgTAP manually."
            print_warning "See: https://pgtap.org/download.html"
            ;;
    esac
}

# Install pg_prove (Perl test runner)
install_pg_prove() {
    if command -v cpan >/dev/null 2>&1; then
        print_status "Installing pg_prove via CPAN..."
        cpan TAP::Parser::SourceHandler::pgTAP
    elif command -v apt-get >/dev/null 2>&1; then
        print_status "Installing pg_prove via apt..."
        sudo apt-get install -y libtap-parser-sourcehandler-pgtap-perl
    elif command -v brew >/dev/null 2>&1; then
        print_status "pg_prove comes with pgTAP on macOS"
    else
        print_warning "Could not install pg_prove. Tests can still run with psql."
    fi
}

# Setup database for testing
setup_test_database() {
    print_status "Setting up test database..."
    
    # Check if DATABASE_URL is set
    if [[ -z "$DATABASE_URL" ]]; then
        print_warning "DATABASE_URL not set. Using default local database."
        DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
    fi
    
    # Create pgTAP extension
    echo "Creating pgTAP extension in database..."
    psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pgtap;" || {
        print_error "Failed to create pgTAP extension. Check database connection."
        exit 1
    }
    
    # Setup test roles
    echo "Setting up test roles..."
    psql "$DATABASE_URL" -f supabase/tests/setup/01-test-roles.sql || {
        print_error "Failed to setup test roles. Check if setup file exists."
        exit 1
    }
    
    print_status "Database setup complete"
}

# Create test runner script
create_test_runner() {
    print_status "Creating test runner script..."
    
    cat > supabase/tests/run-tests.sh << 'EOF'
#!/bin/bash

# pgTAP Test Runner for RLS Policy Validation
# Usage: ./run-tests.sh [test-file.sql]

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Database connection
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/postgres"}

# Check if specific test file provided
if [[ $# -eq 1 ]]; then
    TEST_FILE="$1"
    if [[ ! -f "$TEST_FILE" ]]; then
        echo -e "${RED}❌ Test file not found: $TEST_FILE${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🧪 Running single test: $TEST_FILE${NC}"
    psql "$DATABASE_URL" -f "$TEST_FILE"
else
    # Run all RLS tests
    echo -e "${YELLOW}🧪 Running all RLS tests...${NC}"
    
    if command -v pg_prove >/dev/null 2>&1; then
        # Use pg_prove for better output
        pg_prove --ext .sql --recursive rls/
    else
        # Fallback to psql
        for test_file in rls/*.test.sql; do
            if [[ -f "$test_file" ]]; then
                echo -e "${YELLOW}Running: $test_file${NC}"
                psql "$DATABASE_URL" -f "$test_file"
            fi
        done
    fi
fi

echo -e "${GREEN}✅ pgTAP tests completed${NC}"
EOF

    chmod +x supabase/tests/run-tests.sh
    print_status "Test runner created at supabase/tests/run-tests.sh"
}

# Update package.json with test scripts
update_package_json() {
    print_status "Adding pgTAP test scripts to package.json..."
    
    # Check if jq is available for JSON manipulation
    if command -v jq >/dev/null 2>&1; then
        # Add test scripts using jq
        tmp=$(mktemp)
        jq '.scripts["test:rls"] = "cd supabase/tests && ./run-tests.sh"' package.json > "$tmp" && mv "$tmp" package.json
        jq '.scripts["test:rls:verbose"] = "cd supabase/tests && pg_prove --verbose --ext .sql rls/"' package.json > "$tmp" && mv "$tmp" package.json
        jq '.scripts["test:rls:single"] = "cd supabase/tests && ./run-tests.sh"' package.json > "$tmp" && mv "$tmp" package.json
        print_status "Added test:rls, test:rls:verbose, and test:rls:single scripts"
    else
        print_warning "jq not found. Please manually add these scripts to package.json:"
        echo '"test:rls": "cd supabase/tests && ./run-tests.sh",'
        echo '"test:rls:verbose": "cd supabase/tests && pg_prove --verbose --ext .sql rls/",'
        echo '"test:rls:single": "cd supabase/tests && ./run-tests.sh"'
    fi
}

# Create CI/CD configuration
create_ci_config() {
    print_status "Creating CI/CD configuration for pgTAP..."
    
    mkdir -p .github/workflows
    
    cat > .github/workflows/pgtap-tests.yml << 'EOF'
name: pgTAP RLS Tests

on:
  push:
    branches: [ main, develop ]
    paths: 
      - 'supabase/tests/rls/**'
      - 'scripts/migrations/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'supabase/tests/rls/**'
      - 'scripts/migrations/**'

jobs:
  pgtap-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pgTAP
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-15-pgtap libtap-parser-sourcehandler-pgtap-perl
      
      - name: Setup database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
        run: |
          # Install pgTAP extension
          psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pgtap;"
          
          # Setup test roles
          psql $DATABASE_URL -f supabase/tests/setup/01-test-roles.sql
          
          # Run migrations if they exist
          if [ -d "scripts/migrations" ]; then
            for migration in scripts/migrations/*.sql; do
              if [ -f "$migration" ]; then
                psql $DATABASE_URL -f "$migration"
              fi
            done
          fi
      
      - name: Run pgTAP RLS tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
        run: |
          cd supabase/tests
          pg_prove --ext .sql --recursive rls/
EOF

    print_status "Created CI/CD workflow at .github/workflows/pgtap-tests.yml"
}

# Verify installation
verify_installation() {
    print_status "Verifying pgTAP installation..."
    
    # Check pgTAP extension
    if psql "$DATABASE_URL" -c "SELECT 1 FROM pg_extension WHERE extname = 'pgtap';" | grep -q "1"; then
        print_status "pgTAP extension is installed"
    else
        print_error "pgTAP extension not found"
        exit 1
    fi
    
    # Check test roles
    if psql "$DATABASE_URL" -c "SELECT 1 FROM pg_roles WHERE rolname = 'integration_tester';" | grep -q "1"; then
        print_status "Test roles are configured"
    else
        print_error "Test roles not found"
        exit 1
    fi
    
    print_status "pgTAP setup verification complete"
}

# Main execution
main() {
    echo "🚀 Starting pgTAP setup for dual-track testing strategy..."
    echo ""
    
    # Create directories if they don't exist
    mkdir -p supabase/tests/rls
    mkdir -p supabase/tests/setup
    
    # Install components
    install_pgtap
    install_pg_prove
    setup_test_database
    create_test_runner
    update_package_json
    create_ci_config
    verify_installation
    
    echo ""
    echo -e "${GREEN}🎉 pgTAP setup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run test:rls' to test the setup"
    echo "2. Create RLS test files in supabase/tests/rls/"
    echo "3. Follow the dual-track testing strategy documentation"
    echo ""
    echo "Documentation:"
    echo "- docs/testing/pgtap-rls-testing.md"
    echo "- docs/testing/dual-track-testing-strategy.md"
    echo "- supabase/tests/rls/README.md"
}

# Run main function
main "$@"