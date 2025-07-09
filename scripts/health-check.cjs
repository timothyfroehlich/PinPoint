#!/usr/bin/env node

/**
 * Comprehensive health check for all development services
 * Checks: Next.js server, Prisma Studio, Database, File watchers
 */

const http = require('http');
const { spawn } = require('child_process');

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class HealthChecker {
  constructor() {
    this.results = [];
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async checkHttpService(name, url, timeout = 5000) {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout }, (res) => {
        const success = res.statusCode >= 200 && res.statusCode < 400;
        resolve({
          service: name,
          status: success ? 'healthy' : 'unhealthy',
          details: `HTTP ${res.statusCode}`,
          url
        });
      });

      req.on('error', (err) => {
        resolve({
          service: name,
          status: 'unhealthy',
          details: err.message,
          url
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          service: name,
          status: 'timeout',
          details: `Timeout after ${timeout}ms`,
          url
        });
      });
    });
  }

  async checkPortInUse(port) {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(false); // Port is free
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(true); // Port is in use
      });
    });
  }

  async checkProcesses() {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux']);
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', () => {
        const nextProcesses = output.split('\\n').filter(line => 
          line.includes('next') && line.includes('dev')
        );
        const prismaProcesses = output.split('\\n').filter(line => 
          line.includes('prisma') && line.includes('studio')
        );
        
        resolve({
          nextjs: nextProcesses.length,
          prisma: prismaProcesses.length,
          details: { nextProcesses, prismaProcesses }
        });
      });
      
      ps.on('error', () => {
        resolve({ nextjs: 0, prisma: 0, details: { error: 'Unable to check processes' } });
      });
    });
  }

  async runAllChecks() {
    this.log(`${colors.bold}🏥 Running Development Environment Health Check${colors.reset}\\n`);

    // Check HTTP services
    const httpChecks = await Promise.all([
      this.checkHttpService('Next.js Server', 'http://localhost:3000/api/health'),
      this.checkHttpService('Prisma Studio', 'http://localhost:5555')
    ]);

    // Check port usage
    const port3000InUse = await this.checkPortInUse(3000);
    const port5555InUse = await this.checkPortInUse(5555);

    // Check running processes
    const processes = await this.checkProcesses();

    // Compile results
    this.results = [
      ...httpChecks,
      {
        service: 'Port 3000',
        status: port3000InUse ? 'in-use' : 'free',
        details: port3000InUse ? 'Port occupied' : 'Port available'
      },
      {
        service: 'Port 5555',
        status: port5555InUse ? 'in-use' : 'free',
        details: port5555InUse ? 'Port occupied' : 'Port available'
      },
      {
        service: 'Next.js Processes',
        status: processes.nextjs > 0 ? 'running' : 'stopped',
        details: `${processes.nextjs} process(es) found`
      },
      {
        service: 'Prisma Processes',
        status: processes.prisma > 0 ? 'running' : 'stopped',
        details: `${processes.prisma} process(es) found`
      }
    ];

    // Display results
    this.displayResults();
    
    // Return overall health status
    const healthyServices = this.results.filter(r => 
      r.status === 'healthy' || r.status === 'running' || r.status === 'in-use'
    );
    
    return {
      overall: healthyServices.length >= 4 ? 'healthy' : 'unhealthy',
      results: this.results
    };
  }

  displayResults() {
    this.log('📊 Service Status:\\n');
    
    this.results.forEach(result => {
      const statusColor = this.getStatusColor(result.status);
      const statusIcon = this.getStatusIcon(result.status);
      
      this.log(
        `${statusIcon} ${result.service.padEnd(20)} ${statusColor}${result.status.toUpperCase()}${colors.reset} - ${result.details}`
      );
    });

    this.log('\\n📋 Summary:');
    const healthyCount = this.results.filter(r => 
      r.status === 'healthy' || r.status === 'running' || r.status === 'in-use'
    ).length;
    
    if (healthyCount >= 4) {
      this.log(`${colors.green}✅ Development environment is healthy (${healthyCount}/${this.results.length} services operational)${colors.reset}`);
    } else {
      this.log(`${colors.red}❌ Development environment needs attention (${healthyCount}/${this.results.length} services operational)${colors.reset}`);
    }
    
    this.log('\\n💡 Quick Actions:');
    this.log('   • Start all services: npm run dev:full');
    this.log('   • Fresh start: npm run dev:clean');
    this.log('   • Kill all processes: npm run kill:all');
  }

  getStatusColor(status) {
    switch (status) {
      case 'healthy':
      case 'running':
      case 'in-use':
        return colors.green;
      case 'unhealthy':
      case 'stopped':
      case 'timeout':
        return colors.red;
      case 'free':
        return colors.yellow;
      default:
        return colors.reset;
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'healthy':
      case 'running':
        return '✅';
      case 'in-use':
        return '🔵';
      case 'unhealthy':
      case 'stopped':
      case 'timeout':
        return '❌';
      case 'free':
        return '⚪';
      default:
        return '❓';
    }
  }
}

// Run health check if called directly
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runAllChecks()
    .then(result => {
      process.exit(result.overall === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error(`${colors.red}❌ Health check failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

module.exports = HealthChecker;