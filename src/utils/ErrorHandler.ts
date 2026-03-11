/**
 * 前端错误处理工具类
 */

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
  };
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  SYSTEM = 'system',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

/**
 * 错误处理类
 */
export class ErrorHandler {
  /**
   * 主错误处理方法
   */
  static handle(error: any): void {
    console.error('[ErrorHandler]', error);

    if (error.response) {
      // HTTP 错误响应
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          this.showValidationError(data);
          break;
        case 403:
          this.showPermissionError(data);
          break;
        case 404:
          this.showNotFoundError(data);
          break;
        case 409:
          this.showConflictError(data);
          break;
        case 500:
          this.logError(error);
          this.showSystemError(data);
          break;
        default:
          this.showGenericError(data);
      }
    } else if (error.request) {
      // 网络错误
      this.showNetworkError();
    } else {
      // 其他错误
      this.logError(error);
      this.showGenericError();
    }
  }

  /**
   * 显示验证错误
   */
  private static showValidationError(data: ErrorResponse): void {
    const message = data?.error?.message || '数据验证失败，请检查输入';
    const field = data?.error?.field;
    
    if (field) {
      this.showError(`${field}: ${message}`, ErrorType.VALIDATION);
    } else {
      this.showError(message, ErrorType.VALIDATION);
    }
  }

  /**
   * 显示权限错误
   */
  private static showPermissionError(data: ErrorResponse): void {
    const errorCode = data?.error?.code;
    let message = data?.error?.message || '您没有权限执行此操作';

    // 特殊处理常见权限错误
    if (errorCode === 'PERIOD_CLOSED') {
      message = '该会计期间已结账，无法修改数据';
    } else if (errorCode === 'VOUCHER_ALREADY_APPROVED') {
      message = '凭证已审核，无法修改或删除';
    }

    this.showError(message, ErrorType.PERMISSION);
  }

  /**
   * 显示资源不存在错误
   */
  private static showNotFoundError(data: ErrorResponse): void {
    const message = data?.error?.message || '请求的资源不存在';
    this.showError(message, ErrorType.NOT_FOUND);
  }

  /**
   * 显示冲突错误
   */
  private static showConflictError(data: ErrorResponse): void {
    const errorCode = data?.error?.code;
    let message = data?.error?.message || '操作冲突，请刷新后重试';

    // 特殊处理常见冲突错误
    if (errorCode === 'DUPLICATE_RECORD') {
      message = '记录已存在，请检查是否重复';
    } else if (errorCode === 'DUPLICATE_ACCOUNT_CODE') {
      message = '科目编码已存在，请使用其他编码';
    }

    this.showError(message, ErrorType.CONFLICT);
  }

  /**
   * 显示系统错误
   */
  private static showSystemError(data?: ErrorResponse): void {
    const message = data?.error?.message || '系统错误，请稍后重试';
    this.showError(message, ErrorType.SYSTEM);
  }

  /**
   * 显示网络错误
   */
  private static showNetworkError(): void {
    this.showError('网络连接失败，请检查网络设置', ErrorType.NETWORK);
  }

  /**
   * 显示通用错误
   */
  private static showGenericError(data?: ErrorResponse): void {
    const message = data?.error?.message || '操作失败，请重试';
    this.showError(message, ErrorType.UNKNOWN);
  }

  /**
   * 显示错误消息（使用 Toast 或其他 UI 组件）
   */
  private static showError(message: string, type: ErrorType): void {
    // 检查是否有全局 Toast 组件
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast(message, 'error');
    } else {
      // 降级到 alert
      alert(`错误: ${message}`);
    }

    // 记录到控制台
    console.error(`[${type.toUpperCase()}]`, message);
  }

  /**
   * 记录错误日志
   */
  private static logError(error: any): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      type: error.name
    };

    console.error('[Error Log]', errorLog);

    // 可以在这里添加发送错误日志到服务器的逻辑
    // this.sendErrorToServer(errorLog);
  }

  /**
   * 获取友好的错误消息
   */
  static getFriendlyMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      // 凭证相关
      VOUCHER_NOT_BALANCED: '凭证借贷不平衡，请检查金额',
      VOUCHER_NOT_FOUND: '凭证不存在',
      VOUCHER_ALREADY_APPROVED: '凭证已审核，无法修改',
      
      // 期间相关
      PERIOD_CLOSED: '会计期间已结账，无法修改',
      PERIOD_NOT_FOUND: '会计期间不存在',
      
      // 科目相关
      ACCOUNT_HAS_BALANCE: '科目有发生额，无法删除',
      ACCOUNT_NOT_FOUND: '科目不存在',
      DUPLICATE_ACCOUNT_CODE: '科目编码已存在',
      INVALID_ACCOUNT_CODE_FORMAT: '科目编码格式错误',
      
      // 辅助核算
      MISSING_AUXILIARY_DATA: '缺少必填的辅助核算信息',
      
      // 金额相关
      INVALID_AMOUNT_PRECISION: '金额精度错误，最多保留两位小数',
      INVALID_AMOUNT: '金额格式错误',
      
      // 结账相关
      CLOSING_PRECONDITION_FAILED: '结账前置条件未满足',
      
      // 成本相关
      COST_VARIANCE_THRESHOLD_EXCEEDED: '成本差异超过阈值',
      
      // 通用
      DUPLICATE_RECORD: '记录已存在',
      RECORD_NOT_FOUND: '记录不存在',
      INVALID_INPUT: '输入数据无效',
      PERMISSION_DENIED: '权限不足'
    };

    return messages[errorCode] || '操作失败';
  }

  /**
   * 验证金额精度
   */
  static validateAmountPrecision(amount: number): boolean {
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }

  /**
   * 格式化金额（保留两位小数）
   */
  static formatAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}

/**
 * 导出便捷方法
 */
export const handleError = (error: any) => ErrorHandler.handle(error);
export const getFriendlyMessage = (errorCode: string) => ErrorHandler.getFriendlyMessage(errorCode);
export const validateAmountPrecision = (amount: number) => ErrorHandler.validateAmountPrecision(amount);
export const formatAmount = (amount: number) => ErrorHandler.formatAmount(amount);
