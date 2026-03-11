import { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";

/**
 * 会计期间锁定中间件
 * 拦截对已结账期间的数据修改请求 (POST, PUT, DELETE, PATCH)
 */
export function createPeriodLockMiddleware(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 仅拦截修改类操作
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const date = req.body.date || req.body.acquisition_date || req.body.disposal_date || req.body.timestamp;
      
      // 如果请求体中包含日期，检查该日期所属期间是否已锁定
      if (date && typeof date === 'string') {
        const month = date.substring(0, 7); // YYYY-MM
        const period = db.prepare("SELECT * FROM closing_periods WHERE month = ? AND status = 'closed'").get(month) as any;
        
        if (period) {
          return res.status(403).json({ 
            error: `会计期间 [${month}] 已结账锁定，禁止修改数据。如需操作请先执行“反结账”。`,
            code: 'PERIOD_LOCKED'
          });
        }
      }
    }
    next();
  };
}
