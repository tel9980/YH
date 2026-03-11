/**
 * 性能监控工具
 * 用于监控和记录关键操作的性能指标
 * Task 32: 性能优化
 */

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  details?: any;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000; // 最多保留1000条记录

  /**
   * 开始计时
   */
  startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString()
      });
      
      // 如果超过性能目标，记录警告
      this.checkPerformanceTarget(operation, duration);
    };
  }

  /**
   * 记录性能指标
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // 保持metrics数组大小在限制内
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 检查性能目标
   */
  private checkPerformanceTarget(operation: string, duration: number): void {
    const targets: Record<string, number> = {
      'voucher_query': 500,        // 凭证查询 < 500ms
      'report_generation': 2000,   // 报表生成 < 2s
      'closing_process': 5000      // 月末结账 < 5s
    };

    const target = targets[operation];
    if (target && duration > target) {
      console.warn(`⚠️ 性能警告: ${operation} 耗时 ${duration}ms，超过目标 ${target}ms`);
    }
  }

  /**
   * 获取性能统计
   */
  getStatistics(operation?: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
  } {
    const filteredMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0
      };
    }

    const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: filteredMetrics.length,
      avgDuration: sum / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[p95Index] || durations[durations.length - 1]
    };
  }

  /**
   * 获取最近的性能指标
   */
  getRecentMetrics(count: number = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * 清除所有指标
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * 生成性能报告
   */
  generateReport(): string {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    
    let report = '=== 性能监控报告 ===\n\n';
    
    for (const operation of operations) {
      const stats = this.getStatistics(operation);
      report += `操作: ${operation}\n`;
      report += `  调用次数: ${stats.count}\n`;
      report += `  平均耗时: ${stats.avgDuration.toFixed(2)}ms\n`;
      report += `  最小耗时: ${stats.minDuration.toFixed(2)}ms\n`;
      report += `  最大耗时: ${stats.maxDuration.toFixed(2)}ms\n`;
      report += `  P95耗时: ${stats.p95Duration.toFixed(2)}ms\n`;
      report += '\n';
    }
    
    return report;
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

