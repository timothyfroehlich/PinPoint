#!/usr/bin/env python3
"""
PinPoint Worktree Management Tool

Unified tool for managing Git worktrees with proper environment setup.
Consolidates functionality from multiple bash scripts into a single maintainable tool.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import tomllib  # Python 3.11+ built-in (read-only)
import re

# Colors for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    PURPLE = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


class WorktreeManager:
    """Main class for worktree management operations."""
    
    def __init__(self):
        self.project_root = self._find_project_root()
        self.worktrees_dir = self.project_root / "worktrees"
        
    def _find_project_root(self) -> Path:
        """Find the project root directory by looking for .git directory."""
        current = Path.cwd()
        while current != current.parent:
            if (current / ".git").exists():
                return current
            current = current.parent
        raise RuntimeError("Not in a git repository")
    
    def _run_command(self, cmd: List[str], cwd: Optional[Path] = None, capture_output: bool = True) -> subprocess.CompletedProcess:
        """Run a shell command with error handling."""
        try:
            return subprocess.run(cmd, cwd=cwd, capture_output=capture_output, text=True, check=True)
        except subprocess.CalledProcessError as e:
            print(f"{Colors.RED}❌ Command failed: {' '.join(cmd)}{Colors.NC}")
            print(f"{Colors.RED}Error: {e.stderr}{Colors.NC}")
            sys.exit(1)
    
    def _calculate_ports(self, worktree_path: str) -> Dict[str, int]:
        """Calculate unique ports for a worktree based on path hash."""
        # Use the same hashing logic as the bash script
        hash_obj = hashlib.md5(worktree_path.encode())
        worktree_hash = hash_obj.hexdigest()[:4]
        port_offset = int(worktree_hash, 16) % 100
        base_port = 54320 + port_offset
        
        return {
            'api': base_port + 1,
            'db': base_port + 2,
            'studio': base_port + 3,
            'inbucket': base_port + 4,
            'hash': worktree_hash
        }
    
    def _print_ports(self, ports: Dict[str, int]):
        """Print port configuration with colors."""
        print(f"{Colors.BLUE}🔧 Worktree Setup - Unique Ports:{Colors.NC}")
        print(f"   API: {Colors.CYAN}{ports['api']}{Colors.NC} | "
              f"DB: {Colors.CYAN}{ports['db']}{Colors.NC} | "
              f"Studio: {Colors.CYAN}{ports['studio']}{Colors.NC} | "
              f"Email: {Colors.CYAN}{ports['inbucket']}{Colors.NC}")
    
    def create_worktree(self, task_name: str, base_branch: Optional[str] = None) -> None:
        """Create a new worktree with full environment setup."""
        print(f"{Colors.BLUE}🚀 Creating Worktree for Task: {task_name}{Colors.NC}")
        print("=" * 40)
        
        # Validate task name
        if not task_name.replace('-', '').replace('_', '').isalnum():
            print(f"{Colors.RED}❌ Task name can only contain letters, numbers, hyphens, and underscores{Colors.NC}")
            sys.exit(1)
        
        # Determine base branch
        if base_branch is None:
            result = self._run_command(['git', 'branch', '--show-current'], cwd=self.project_root)
            base_branch = result.stdout.strip()
        
        branch_name = f"task/{task_name}"
        worktree_path = self.worktrees_dir / task_name
        
        # Check if worktree already exists
        if worktree_path.exists():
            print(f"{Colors.RED}❌ Worktree already exists at {worktree_path}{Colors.NC}")
            print(f"Use 'git worktree remove {worktree_path}' to remove it first")
            sys.exit(1)
        
        # Check if branch already exists
        result = subprocess.run(['git', 'show-ref', '--verify', '--quiet', f'refs/heads/{branch_name}'], 
                               cwd=self.project_root, capture_output=True)
        if result.returncode == 0:
            print(f"{Colors.RED}❌ Branch '{branch_name}' already exists{Colors.NC}")
            print("Use a different task name or delete the existing branch first")
            sys.exit(1)
        
        # Fetch latest changes
        print(f"{Colors.YELLOW}📡 Fetching latest changes...{Colors.NC}")
        self._run_command(['git', 'fetch', 'origin'], cwd=self.project_root)
        
        # Create worktree directory
        self.worktrees_dir.mkdir(exist_ok=True)
        
        # Create the worktree with new branch
        print(f"{Colors.YELLOW}🌿 Creating worktree and branch...{Colors.NC}")
        self._run_command(['git', 'worktree', 'add', '-b', branch_name, str(worktree_path), base_branch], 
                         cwd=self.project_root)
        print(f"{Colors.GREEN}✓ Worktree created successfully{Colors.NC}")
        
        # Setup the worktree environment
        self._setup_worktree_environment(worktree_path)
        
        # Display final information
        print(f"\n{Colors.BLUE}🎉 Worktree Creation Complete!{Colors.NC}")
        print("=" * 40)
        print(f"{Colors.BLUE}📍 Path:{Colors.NC} {worktree_path}")
        print(f"{Colors.BLUE}🌿 Branch:{Colors.NC} {branch_name}")
        print(f"{Colors.BLUE}📋 Task Management:{Colors.NC} Via GitHub issues")
        print(f"\n{Colors.BLUE}📝 Next Steps:{Colors.NC}")
        print(f"1. Navigate to the worktree: cd {worktree_path}")
        print("2. Start development: npm run dev (Supabase services already running)")
        print("3. Use orchestrator to create GitHub issue with task specifications")
    
    def _setup_worktree_environment(self, worktree_path: Path) -> None:
        """Setup the worktree environment (equivalent to setup-worktree.sh)."""
        print(f"{Colors.YELLOW}⚙️  Running worktree setup...{Colors.NC}")
        
        # Calculate unique ports
        ports = self._calculate_ports(str(worktree_path))
        self._print_ports(ports)
        
        # Copy Vercel configuration from main worktree
        main_vercel_dir = self.project_root / ".vercel"
        worktree_vercel_dir = worktree_path / ".vercel"
        
        if main_vercel_dir.exists():
            print("Copying Vercel project configuration...")
            shutil.copytree(main_vercel_dir, worktree_vercel_dir)
        else:
            print("No .vercel directory found in main worktree. Linking to Vercel project...")
            self._run_command(['vercel', 'link', '--yes', '--project', 'pin-point', '--scope', 'advacar'], 
                            cwd=worktree_path)
            
            # Copy back to main worktree for future use
            if worktree_vercel_dir.exists():
                print("Copying Vercel config back to main worktree for future worktrees...")
                if main_vercel_dir.exists():
                    shutil.rmtree(main_vercel_dir)
                shutil.copytree(worktree_vercel_dir, main_vercel_dir)
        
        # Pull environment variables from Vercel
        print(f"{Colors.YELLOW}📥 Pulling environment variables from Vercel...{Colors.NC}")
        self._run_command(['vercel', 'env', 'pull', '.env'], cwd=worktree_path)
        
        # Update environment variables with worktree-specific ports
        print(f"{Colors.YELLOW}⚙️  Updating environment variables with unique ports...{Colors.NC}")
        env_file = worktree_path / ".env"
        with open(env_file, 'a') as f:
            f.write(f"""
# Worktree-specific port configuration (auto-generated)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:{ports['api']}
SUPABASE_API_URL=http://localhost:{ports['api']}
DATABASE_URL=postgresql://postgres:postgres@localhost:{ports['db']}/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:{ports['db']}/postgres
""")
        
        # Create symlink for .env.local
        env_local = worktree_path / ".env.local"
        if env_local.exists():
            env_local.unlink()
        env_local.symlink_to(".env")
        
        print(f"{Colors.GREEN}✅ Environment configured with unique ports for this worktree{Colors.NC}")
        
        # Install dependencies
        print("Installing dependencies...")
        self._run_command(['npm', 'install'], cwd=worktree_path, capture_output=False)
        
        # Setup Supabase configuration
        self._setup_supabase_config(worktree_path, ports)
        
        # Start Supabase services
        self._start_supabase_services(worktree_path)
        
        # Setup database schema
        self._setup_database_schema(worktree_path)
        
        # Create port info file
        self._create_port_info_file(worktree_path, ports)
        
        # Run health checks
        self._run_health_checks(worktree_path, ports)
        
        print(f"\n{Colors.GREEN}🎉 Worktree setup complete!{Colors.NC}")
        print(f"{Colors.BLUE}📍 Ports:{Colors.NC} API({ports['api']}) DB({ports['db']}) Studio({ports['studio']}) Email({ports['inbucket']})")
        print(f"{Colors.GREEN}🚀 Services:{Colors.NC} Supabase containers are running and ready")
        print(f"{Colors.BLUE}💡 Run './manage-worktree.py status {worktree_path.name}' to check environment health anytime{Colors.NC}")
    
    def _setup_supabase_config(self, worktree_path: Path, ports: Dict[str, int]) -> None:
        """Setup Supabase configuration by copying and modifying the base config."""
        print(f"{Colors.YELLOW}🚀 Initializing Supabase configuration...{Colors.NC}")
        
        supabase_dir = worktree_path / "supabase"
        base_config = self.project_root / "supabase" / "config.toml"
        worktree_config = supabase_dir / "config.toml"
        
        if not base_config.exists():
            print(f"{Colors.RED}❌ Base Supabase config not found at {base_config}{Colors.NC}")
            return
        
        # Copy base config to worktree
        shutil.copy2(base_config, worktree_config)
        
        # Load the config to validate it's valid TOML
        with open(worktree_config, 'rb') as f:
            config = tomllib.load(f)  # Just to validate, we'll modify by text replacement
        
        # Update ports using regex replacement (simpler than full TOML writing)
        self._update_toml_ports(worktree_config, ports)
        
        print(f"{Colors.GREEN}✅ Supabase config optimized with ports API:{ports['api']} DB:{ports['db']}{Colors.NC}")
    
    def _start_supabase_services(self, worktree_path: Path) -> None:
        """Start Supabase Docker services for this worktree."""
        print(f"{Colors.YELLOW}🐳 Starting Supabase services...{Colors.NC}")
        
        try:
            # Check if Supabase is already running
            result = subprocess.run(['supabase', 'status'], 
                                  cwd=worktree_path, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"{Colors.YELLOW}⚠️  Supabase services already running{Colors.NC}")
                return
        except subprocess.CalledProcessError:
            pass  # Services not running, we'll start them
        
        try:
            # Start Supabase services
            print("   Starting Docker containers...")
            self._run_command(['supabase', 'start'], cwd=worktree_path, capture_output=False)
            print(f"{Colors.GREEN}✅ Supabase services started successfully{Colors.NC}")
            
            # Wait a moment for services to fully initialize
            print("   Waiting for services to initialize...")
            time.sleep(3)
            
        except subprocess.CalledProcessError as e:
            print(f"{Colors.YELLOW}⚠️  Warning: Could not start Supabase services automatically{Colors.NC}")
            print(f"{Colors.YELLOW}   You can start them manually with: supabase start{Colors.NC}")
            print(f"{Colors.YELLOW}   Error: {e.stderr.strip() if e.stderr else 'Unknown error'}{Colors.NC}")
    
    def _update_toml_ports(self, config_file: Path, ports: Dict[str, int]) -> None:
        """Update port values in TOML config file using regex replacement."""
        with open(config_file, 'r') as f:
            content = f.read()
        
        # Define port replacements
        replacements = [
            (r'(\[api\].*?port\s*=\s*)\d+', rf'\g<1>{ports["api"]}'),
            (r'(\[db\].*?port\s*=\s*)\d+', rf'\g<1>{ports["db"]}'),
            (r'(shadow_port\s*=\s*)\d+', rf'\g<1>{ports["db"] - 2}'),
            (r'(\[studio\].*?port\s*=\s*)\d+', rf'\g<1>{ports["studio"]}'),
            (r'(\[inbucket\].*?port\s*=\s*)\d+', rf'\g<1>{ports["inbucket"]}'),
            (r'(inspector_port\s*=\s*)\d+', rf'\g<1>{ports["api"] + 100}'),
            (r'(\[analytics\].*?port\s*=\s*)\d+', rf'\g<1>{ports["api"] + 200}'),
        ]
        
        # Apply replacements
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # Write back the modified content
        with open(config_file, 'w') as f:
            f.write(content)
    
    def _setup_database_schema(self, worktree_path: Path) -> None:
        """Setup database schema using shared online database."""
        print("Setting up database schema...")
        try:
            self._run_command(['npm', 'run', 'db:push'], cwd=worktree_path, capture_output=False)
            print("Database schema synced successfully.")
            
            # Generate Prisma client types
            print("Generating Prisma client types...")
            self._run_command(['npx', 'prisma', 'generate'], cwd=worktree_path, capture_output=False)
            print("Prisma client types generated successfully.")
        except subprocess.CalledProcessError:
            print(f"{Colors.YELLOW}⚠️  Warning: Could not sync database schema.{Colors.NC}")
            print("Check your database connection and run 'npm run db:push' manually.")
    
    def _create_port_info_file(self, worktree_path: Path, ports: Dict[str, int]) -> None:
        """Create a port info file for reference."""
        port_file = worktree_path / ".worktree-ports"
        with open(port_file, 'w') as f:
            f.write(f"""# Worktree Port Configuration
# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}
API_PORT={ports['api']}
DB_PORT={ports['db']}
STUDIO_PORT={ports['studio']}
INBUCKET_PORT={ports['inbucket']}
WORKTREE_HASH={ports['hash']}
""")
    
    def _run_health_checks(self, worktree_path: Path, ports: Dict[str, int]) -> None:
        """Run basic health checks on services."""
        print(f"{Colors.BLUE}🔍 Performing service health checks...{Colors.NC}")
        
        # Check if Supabase is running
        try:
            subprocess.run(['curl', '-f', '-s', f"http://localhost:{ports['api']}/health"], 
                         capture_output=True, check=True, timeout=5)
            print(f"{Colors.GREEN}✅ Supabase API (port {ports['api']}): Healthy{Colors.NC}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            print(f"{Colors.YELLOW}⚠️  Supabase API (port {ports['api']}): Not responding (run 'supabase start' if needed){Colors.NC}")
        
        # Check database connectivity
        try:
            subprocess.run(['pg_isready', '-p', str(ports['db']), '-h', 'localhost'], 
                         capture_output=True, check=True, timeout=5)
            print(f"{Colors.GREEN}✅ PostgreSQL (port {ports['db']}): Healthy{Colors.NC}")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            print(f"{Colors.YELLOW}⚠️  PostgreSQL (port {ports['db']}): Not responding{Colors.NC}")

    def _parse_port_config(self, worktree_path: Path) -> Optional[Dict[str, int]]:
        """Parse port configuration from .worktree-ports file."""
        port_file = worktree_path / ".worktree-ports"
        if not port_file.exists():
            return None
        
        ports = {}
        try:
            with open(port_file, 'r') as f:
                for line in f:
                    if '=' in line and not line.strip().startswith('#'):
                        key, value = line.strip().split('=', 1)
                        if key.endswith('_PORT'):
                            port_name = key.replace('_PORT', '').lower()
                            ports[port_name] = int(value)
                        elif key == 'WORKTREE_HASH':
                            ports['hash'] = value
            return ports
        except (ValueError, IOError):
            return None

    def _check_docker_containers(self, worktree_name: str) -> Dict[str, str]:
        """Check status of Docker containers for this worktree."""
        container_status = {}
        try:
            result = subprocess.run(['docker', 'ps', '--format', '{{.Names}}\\t{{.Status}}'], 
                                  capture_output=True, text=True, check=True)
            
            for line in result.stdout.strip().split('\n'):
                if line and f'_{worktree_name}' in line:
                    parts = line.split('\t', 1)
                    if len(parts) == 2:
                        container_name = parts[0]
                        status = parts[1]
                        # Extract service name from container name
                        service_name = container_name.replace(f'supabase_', '').replace(f'_{worktree_name}', '')
                        container_status[service_name] = status
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        return container_status

    def _check_node_processes(self, worktree_path: Path) -> List[Dict[str, str]]:
        """Check for Node.js processes running from this worktree."""
        processes = []
        try:
            result = subprocess.run(['ps', 'aux'], capture_output=True, text=True, check=True)
            worktree_str = str(worktree_path)
            
            for line in result.stdout.split('\n'):
                if 'node' in line and worktree_str in line:
                    parts = line.split()
                    if len(parts) >= 11:
                        processes.append({
                            'pid': parts[1],
                            'cpu': parts[2],
                            'mem': parts[3],
                            'command': ' '.join(parts[10:])[:80] + '...' if len(' '.join(parts[10:])) > 80 else ' '.join(parts[10:])
                        })
        except subprocess.CalledProcessError:
            pass
        
        return processes

    def _check_git_status(self, worktree_path: Path) -> Dict[str, str]:
        """Check git status and branch information for the worktree."""
        git_info = {}
        try:
            # Get current branch
            result = subprocess.run(['git', 'branch', '--show-current'], 
                                  cwd=worktree_path, capture_output=True, text=True, check=True)
            git_info['branch'] = result.stdout.strip()
            
            # Get git status
            result = subprocess.run(['git', 'status', '--porcelain'], 
                                  cwd=worktree_path, capture_output=True, text=True, check=True)
            changes = result.stdout.strip()
            if changes:
                git_info['changes'] = len(changes.split('\n')) if changes else 0
                git_info['status'] = 'dirty'
            else:
                git_info['changes'] = 0
                git_info['status'] = 'clean'
            
            # Check if ahead/behind remote
            try:
                result = subprocess.run(['git', 'status', '-b', '--porcelain'], 
                                      cwd=worktree_path, capture_output=True, text=True, check=True)
                status_line = result.stdout.split('\n')[0] if result.stdout else ''
                if 'ahead' in status_line:
                    git_info['sync'] = 'ahead'
                elif 'behind' in status_line:
                    git_info['sync'] = 'behind'
                else:
                    git_info['sync'] = 'up-to-date'
            except subprocess.CalledProcessError:
                git_info['sync'] = 'unknown'
                
        except subprocess.CalledProcessError:
            git_info['error'] = 'Git status check failed'
        
        return git_info

    def _test_connectivity(self, ports: Dict[str, int]) -> Dict[str, bool]:
        """Test connectivity to various services."""
        connectivity = {}
        
        # Test Supabase API
        if 'api' in ports:
            try:
                result = subprocess.run(['curl', '-f', '-s', '--max-time', '3', 
                                       f"http://localhost:{ports['api']}/health"], 
                                      capture_output=True, check=True)
                connectivity['supabase_api'] = True
            except (subprocess.CalledProcessError, FileNotFoundError):
                connectivity['supabase_api'] = False
        
        # Test PostgreSQL
        if 'db' in ports:
            try:
                subprocess.run(['pg_isready', '-p', str(ports['db']), '-h', 'localhost', '-t', '3'], 
                             capture_output=True, check=True)
                connectivity['postgresql'] = True
            except (subprocess.CalledProcessError, FileNotFoundError):
                connectivity['postgresql'] = False
        
        return connectivity

    def show_worktree_status(self, worktree_name: Optional[str] = None) -> None:
        """Show comprehensive status for a worktree or current worktree."""
        if not worktree_name:
            # Detect current worktree from working directory
            current_path = Path.cwd()
            if self.worktrees_dir in current_path.parents:
                worktree_name = current_path.relative_to(self.worktrees_dir).parts[0]
            else:
                print(f"{Colors.RED}❌ Not in a worktree directory. Please specify worktree name.{Colors.NC}")
                return
        
        worktree_path = self.worktrees_dir / worktree_name
        if not worktree_path.exists():
            print(f"{Colors.RED}❌ Worktree '{worktree_name}' not found at {worktree_path}{Colors.NC}")
            return
        
        print(f"{Colors.BLUE}📊 Worktree Status: {worktree_name}{Colors.NC}")
        print("=" * 50)
        
        # Parse port configuration
        ports = self._parse_port_config(worktree_path)
        if ports:
            print(f"{Colors.BLUE}🔧 Port Configuration:{Colors.NC}")
            print(f"   API: {Colors.CYAN}{ports.get('api', 'N/A')}{Colors.NC} | "
                  f"DB: {Colors.CYAN}{ports.get('db', 'N/A')}{Colors.NC} | "
                  f"Studio: {Colors.CYAN}{ports.get('studio', 'N/A')}{Colors.NC} | "
                  f"Email: {Colors.CYAN}{ports.get('inbucket', 'N/A')}{Colors.NC}")
            print(f"   Hash: {Colors.PURPLE}{ports.get('hash', 'N/A')}{Colors.NC}")
        else:
            print(f"{Colors.YELLOW}⚠️  No port configuration found (.worktree-ports missing){Colors.NC}")
            # Calculate ports based on path
            ports = self._calculate_ports(str(worktree_path))
        
        print()
        
        # Git status
        git_info = self._check_git_status(worktree_path)
        print(f"{Colors.BLUE}📋 Git Status:{Colors.NC}")
        if 'error' in git_info:
            print(f"   {Colors.RED}❌ {git_info['error']}{Colors.NC}")
        else:
            branch_color = Colors.GREEN if git_info.get('status') == 'clean' else Colors.YELLOW
            print(f"   Branch: {Colors.CYAN}{git_info.get('branch', 'unknown')}{Colors.NC}")
            print(f"   Status: {branch_color}{git_info.get('status', 'unknown')}{Colors.NC}")
            if git_info.get('changes', 0) > 0:
                print(f"   Changes: {Colors.YELLOW}{git_info['changes']} files{Colors.NC}")
            print(f"   Sync: {Colors.CYAN}{git_info.get('sync', 'unknown')}{Colors.NC}")
        
        print()
        
        # Docker containers
        containers = self._check_docker_containers(worktree_name)
        print(f"{Colors.BLUE}🐳 Docker Services:{Colors.NC}")
        if containers:
            for service, status in containers.items():
                status_color = Colors.GREEN if 'Up' in status else Colors.RED
                print(f"   {service}: {status_color}{status}{Colors.NC}")
        else:
            print(f"   {Colors.YELLOW}⚠️  No Supabase containers running for this worktree{Colors.NC}")
        
        print()
        
        # Node processes
        processes = self._check_node_processes(worktree_path)
        print(f"{Colors.BLUE}⚡ Node.js Processes:{Colors.NC}")
        if processes:
            for proc in processes:
                print(f"   PID {Colors.CYAN}{proc['pid']}{Colors.NC}: {proc['command']}")
                print(f"     CPU: {Colors.YELLOW}{proc['cpu']}%{Colors.NC} | Memory: {Colors.YELLOW}{proc['mem']}%{Colors.NC}")
        else:
            print(f"   {Colors.YELLOW}⚠️  No Node.js processes running from this worktree{Colors.NC}")
        
        print()
        
        # Connectivity tests
        connectivity = self._test_connectivity(ports)
        print(f"{Colors.BLUE}🔗 Service Connectivity:{Colors.NC}")
        for service, is_up in connectivity.items():
            status_color = Colors.GREEN if is_up else Colors.RED
            status_text = "✅ Healthy" if is_up else "❌ Not responding"
            print(f"   {service}: {status_color}{status_text}{Colors.NC}")
        
        print()
        
        # Overall health assessment
        healthy_services = sum(1 for status in connectivity.values() if status)
        total_services = len(connectivity)
        containers_up = sum(1 for status in containers.values() if 'Up' in status)
        total_containers = len(containers)
        
        if healthy_services == total_services and containers_up == total_containers and git_info.get('status') != 'error':
            print(f"{Colors.GREEN}🎉 Worktree Environment: Healthy{Colors.NC}")
        elif healthy_services > 0 or containers_up > 0:
            print(f"{Colors.YELLOW}⚠️  Worktree Environment: Partially functional{Colors.NC}")
        else:
            print(f"{Colors.RED}❌ Worktree Environment: Not functional{Colors.NC}")
        
        print(f"\n{Colors.BLUE}💡 Next steps:{Colors.NC}")
        if not containers:
            print("   • Start Supabase: supabase start")
        if not processes:
            print("   • Start development server: npm run dev")
        if git_info.get('changes', 0) > 0:
            print("   • Review uncommitted changes: git status")

    def _stop_docker_containers(self, worktree_name: str) -> bool:
        """Stop all Docker containers for this worktree."""
        containers = self._check_docker_containers(worktree_name)
        if not containers:
            print(f"   {Colors.YELLOW}⚠️  No containers to stop{Colors.NC}")
            return True
        
        success = True
        for service in containers.keys():
            container_name = f"supabase_{service}_{worktree_name}"
            try:
                print(f"   Stopping {Colors.CYAN}{container_name}{Colors.NC}...")
                subprocess.run(['docker', 'stop', container_name], 
                             capture_output=True, check=True, timeout=30)
                print(f"   {Colors.GREEN}✅ Stopped {service}{Colors.NC}")
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                print(f"   {Colors.RED}❌ Failed to stop {service}{Colors.NC}")
                success = False
        
        return success

    def _kill_node_processes(self, worktree_path: Path) -> bool:
        """Kill Node.js processes running from this worktree."""
        processes = self._check_node_processes(worktree_path)
        if not processes:
            print(f"   {Colors.YELLOW}⚠️  No Node.js processes to kill{Colors.NC}")
            return True
        
        success = True
        for proc in processes:
            try:
                print(f"   Killing Node.js process {Colors.CYAN}PID {proc['pid']}{Colors.NC}...")
                subprocess.run(['kill', proc['pid']], capture_output=True, check=True)
                print(f"   {Colors.GREEN}✅ Killed process {proc['pid']}{Colors.NC}")
            except subprocess.CalledProcessError:
                try:
                    # Try force kill
                    subprocess.run(['kill', '-9', proc['pid']], capture_output=True, check=True)
                    print(f"   {Colors.GREEN}✅ Force killed process {proc['pid']}{Colors.NC}")
                except subprocess.CalledProcessError:
                    print(f"   {Colors.RED}❌ Failed to kill process {proc['pid']}{Colors.NC}")
                    success = False
        
        return success

    def _check_uncommitted_changes(self, worktree_path: Path) -> bool:
        """Check if worktree has uncommitted changes."""
        git_info = self._check_git_status(worktree_path)
        return git_info.get('changes', 0) > 0

    def _remove_worktree(self, worktree_name: str, worktree_path: Path) -> bool:
        """Remove the worktree from git and filesystem."""
        try:
            print(f"   Removing git worktree {Colors.CYAN}{worktree_name}{Colors.NC}...")
            subprocess.run(['git', 'worktree', 'remove', str(worktree_path), '--force'], 
                         cwd=self.project_root, capture_output=True, check=True)
            print(f"   {Colors.GREEN}✅ Git worktree removed{Colors.NC}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"   {Colors.RED}❌ Failed to remove git worktree: {e.stderr.strip()}{Colors.NC}")
            # Try to remove directory manually if git worktree remove failed
            if worktree_path.exists():
                try:
                    shutil.rmtree(worktree_path)
                    print(f"   {Colors.GREEN}✅ Directory removed manually{Colors.NC}")
                    return True
                except OSError as e:
                    print(f"   {Colors.RED}❌ Failed to remove directory: {e}{Colors.NC}")
                    return False
            return False

    def cleanup_worktree(self, worktree_name: Optional[str] = None, 
                        force: bool = False, keep_worktree: bool = False) -> None:
        """Clean up a worktree environment."""
        if not worktree_name:
            # Detect current worktree from working directory
            current_path = Path.cwd()
            if self.worktrees_dir in current_path.parents:
                worktree_name = current_path.relative_to(self.worktrees_dir).parts[0]
            else:
                print(f"{Colors.RED}❌ Not in a worktree directory. Please specify worktree name.{Colors.NC}")
                return
        
        worktree_path = self.worktrees_dir / worktree_name
        if not worktree_path.exists():
            print(f"{Colors.RED}❌ Worktree '{worktree_name}' not found at {worktree_path}{Colors.NC}")
            return
        
        print(f"{Colors.BLUE}🧹 Cleaning up Worktree: {worktree_name}{Colors.NC}")
        print("=" * 50)
        
        # Check for uncommitted changes
        has_changes = self._check_uncommitted_changes(worktree_path)
        if has_changes and not keep_worktree:
            git_info = self._check_git_status(worktree_path)
            print(f"{Colors.YELLOW}⚠️  Warning: Worktree has {git_info.get('changes', 0)} uncommitted changes{Colors.NC}")
            if not force:
                response = input(f"Continue with cleanup? This will remove the worktree directory. (y/N): ")
                if response.lower() not in ['y', 'yes']:
                    print(f"{Colors.YELLOW}⚠️  Cleanup cancelled by user{Colors.NC}")
                    return
        
        cleanup_success = True
        
        # Stop Docker containers
        print(f"\n{Colors.BLUE}🐳 Stopping Docker Services:{Colors.NC}")
        if not self._stop_docker_containers(worktree_name):
            cleanup_success = False
        
        # Kill Node.js processes
        print(f"\n{Colors.BLUE}⚡ Stopping Node.js Processes:{Colors.NC}")
        if not self._kill_node_processes(worktree_path):
            cleanup_success = False
        
        # Clean up Docker volumes and networks if force is enabled
        if force:
            print(f"\n{Colors.BLUE}🔄 Force cleanup - Docker system prune:{Colors.NC}")
            try:
                subprocess.run(['docker', 'system', 'prune', '-f'], 
                             capture_output=True, check=True)
                print(f"   {Colors.GREEN}✅ Docker system cleaned{Colors.NC}")
            except subprocess.CalledProcessError:
                print(f"   {Colors.YELLOW}⚠️  Docker system prune failed{Colors.NC}")
        
        # Remove worktree if requested
        if not keep_worktree:
            print(f"\n{Colors.BLUE}📁 Removing Worktree Directory:{Colors.NC}")
            if not self._remove_worktree(worktree_name, worktree_path):
                cleanup_success = False
        else:
            print(f"\n{Colors.BLUE}📁 Keeping Worktree Directory:{Colors.NC}")
            print(f"   {Colors.CYAN}Directory preserved at: {worktree_path}{Colors.NC}")
        
        # Clean up port file if worktree is being removed
        if not keep_worktree:
            port_file = worktree_path / ".worktree-ports"
            if port_file.exists():
                try:
                    port_file.unlink()
                    print(f"   {Colors.GREEN}✅ Port configuration cleaned{Colors.NC}")
                except OSError:
                    print(f"   {Colors.YELLOW}⚠️  Could not remove port configuration{Colors.NC}")
        
        # Final status
        print("\n" + "=" * 50)
        if cleanup_success:
            action = "cleaned (directory preserved)" if keep_worktree else "removed completely"
            print(f"{Colors.GREEN}🎉 Worktree '{worktree_name}' {action} successfully{Colors.NC}")
        else:
            print(f"{Colors.YELLOW}⚠️  Worktree cleanup completed with some warnings{Colors.NC}")
            print(f"{Colors.BLUE}💡 You may need to manually clean up remaining processes or containers{Colors.NC}")

    def list_worktrees(self) -> None:
        """List all worktrees with their status."""
        print(f"{Colors.BLUE}📋 PinPoint Worktrees Overview{Colors.NC}")
        print("=" * 60)
        
        # Get git worktree list
        try:
            result = subprocess.run(['git', 'worktree', 'list', '--porcelain'], 
                                  cwd=self.project_root, capture_output=True, text=True, check=True)
            
            worktrees = []
            current_worktree = {}
            
            for line in result.stdout.strip().split('\n'):
                if line.startswith('worktree '):
                    if current_worktree:
                        worktrees.append(current_worktree)
                    current_worktree = {'path': line.split(' ', 1)[1]}
                elif line.startswith('HEAD '):
                    current_worktree['commit'] = line.split(' ', 1)[1]
                elif line.startswith('branch '):
                    current_worktree['branch'] = line.split(' ', 1)[1].replace('refs/heads/', '')
                elif line == 'bare':
                    current_worktree['bare'] = True
                elif line == 'detached':
                    current_worktree['detached'] = True
            
            if current_worktree:
                worktrees.append(current_worktree)
            
            # Display worktrees
            for wt in worktrees:
                path = Path(wt['path'])
                is_main = path == self.project_root
                worktree_name = "main" if is_main else path.name
                
                print(f"\n{Colors.BLUE}📂 {worktree_name}{Colors.NC}")
                print(f"   Path: {Colors.CYAN}{path}{Colors.NC}")
                
                if not is_main:
                    # Check port configuration
                    ports = self._parse_port_config(path)
                    if ports:
                        print(f"   Ports: API({ports.get('api')}) DB({ports.get('db')}) Studio({ports.get('studio')})")
                    
                    # Check running services
                    containers = self._check_docker_containers(worktree_name)
                    processes = self._check_node_processes(path)
                    
                    if containers:
                        container_status = f"{len(containers)} containers"
                        print(f"   Docker: {Colors.GREEN}{container_status}{Colors.NC}")
                    
                    if processes:
                        process_status = f"{len(processes)} Node.js processes"
                        print(f"   Node.js: {Colors.GREEN}{process_status}{Colors.NC}")
                    
                    if not containers and not processes:
                        print(f"   Status: {Colors.YELLOW}Inactive{Colors.NC}")
                    else:
                        print(f"   Status: {Colors.GREEN}Active{Colors.NC}")
                
                branch = wt.get('branch', 'detached')
                branch_color = Colors.GREEN if is_main else Colors.CYAN
                print(f"   Branch: {branch_color}{branch}{Colors.NC}")
                
                if wt.get('detached'):
                    print(f"   {Colors.YELLOW}⚠️  Detached HEAD{Colors.NC}")
        
        except subprocess.CalledProcessError:
            print(f"{Colors.RED}❌ Failed to list git worktrees{Colors.NC}")


def main():
    """Main entry point for the worktree management tool."""
    parser = argparse.ArgumentParser(
        description="PinPoint Worktree Management Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s create fix-auth-bug
  %(prog)s create new-feature main
  %(prog)s status worktree-name
  %(prog)s list
  %(prog)s cleanup worktree-name --force
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Create subcommand
    create_parser = subparsers.add_parser('create', help='Create a new worktree')
    create_parser.add_argument('task_name', help='Name for the task (e.g., fix-auth-bug)')
    create_parser.add_argument('base_branch', nargs='?', help='Base branch to branch from (default: current branch)')
    
    # Status subcommand
    status_parser = subparsers.add_parser('status', help='Show worktree status')
    status_parser.add_argument('worktree_path', nargs='?', help='Path to specific worktree (optional)')
    
    # List subcommand
    list_parser = subparsers.add_parser('list', help='List all worktrees')
    
    # Cleanup subcommand
    cleanup_parser = subparsers.add_parser('cleanup', help='Clean up a worktree')
    cleanup_parser.add_argument('worktree_path', nargs='?', help='Path to worktree to clean up')
    cleanup_parser.add_argument('--force', '-f', action='store_true', help='Force cleanup without confirmation')
    cleanup_parser.add_argument('--keep-worktree', '-k', action='store_true', help='Keep worktree directory (only cleanup services)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        manager = WorktreeManager()
        
        if args.command == 'create':
            manager.create_worktree(args.task_name, args.base_branch)
        elif args.command == 'status':
            manager.show_worktree_status(args.worktree_path)
        elif args.command == 'list':
            manager.list_worktrees()
        elif args.command == 'cleanup':
            manager.cleanup_worktree(args.worktree_path, args.force, args.keep_worktree)
            
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}⚠️  Operation cancelled by user{Colors.NC}")
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.RED}❌ Unexpected error: {e}{Colors.NC}")
        sys.exit(1)


if __name__ == '__main__':
    main()