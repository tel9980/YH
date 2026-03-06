import React, { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { GoogleGenAI } from "@google/genai";

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai", content: string }[]>([
    { role: "ai", content: "您好！我是小会计智能助手。您可以问我关于工厂财务的问题，例如：'本月利润是多少？'、'欠款最多的客户是谁？' 或 'G银行余额是多少？'" }
  ]);
  const [loading, setLoading] = useState(false);

  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    return new GoogleGenAI({ apiKey });
  };

  const handleSend = async (customMsg?: string) => {
    const userMsg = customMsg || input;
    if (!userMsg.trim()) return;
    
    if (!customMsg) setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const ai = getAI();
      // Fetch current context for the AI
      const [stats, overdue, bankBalances] = await Promise.all([
        fetch("/api/stats").then(res => res.json()),
        fetch("/api/overdue").then(res => res.json()),
        fetch("/api/bank-balances").then(res => res.json())
      ]);

      const context = `
        当前工厂财务数据：
        - 总收入: ${stats.totalIncome}
        - 总支出: ${stats.totalExpense}
        - 利润: ${stats.profit}
        - 应收账款: ${stats.totalReceivable}
        - 应付账款: ${stats.totalPayable}
        - 订单数: ${stats.orderCount}
        - 待委外订单: ${stats.outsourceCount}
        
        高额欠款客户：
        ${overdue.map((o: any) => `- ${o.customer}: ${o.debt}`).join("\n")}
        
        银行余额：
        ${bankBalances.map((b: any) => `- ${b.bank}: ${b.balance}`).join("\n")}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          你是一个工厂财务助手。基于以下实时数据回答用户问题：
          ${context}
          
          用户问题: ${userMsg}
          请简短、专业地回答。如果问题与财务无关，请礼貌地引导用户。
        `
      });

      setMessages(prev => [...prev, { role: "ai", content: response.text || "抱歉，我无法处理该请求。" }]);
    } catch (e) {
      console.error("AI Error:", e);
      setMessages(prev => [...prev, { role: "ai", content: "抱歉，连接AI服务时出现错误。" }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "本月利润是多少？",
    "谁欠款最多？",
    "现金余额（N银行+微信）是多少？",
    "待委外加工的订单多吗？"
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center">
        <div className="p-2 bg-indigo-600 dark:bg-indigo-500 rounded-lg text-white mr-3">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">智能财务助手</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Powered by Gemini AI</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
              msg.role === "user" 
                ? "bg-indigo-600 dark:bg-indigo-500 text-white rounded-tr-none" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-4">
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q, i) => (
            <button 
              key={i}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="输入您的问题..."
            className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm dark:text-slate-100"
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
