"use client";

import { useState } from "react";

interface Context {
  month?: string;
  type?: string;
  topSupplier?: string;
  months?: string[];
  supplier?: string;
  data?: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<Context | null>(null);

  const askQuestion = async (question: string) => {
    if (!question.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      
      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.error || data.answer,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setContext(data.context);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, there was an error processing your request. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setLoading(false);
    setInput("");
  };

  const handleFollowUp = (option: number) => {
    if (!context) return;
    
    let followUpQuestion = "";
    
    if (context.type === "monthly_statistics") {
      switch (option) {
        case 1:
          followUpQuestion = `What was the average spend in ${context.month}?`;
          break;
        case 2:
          followUpQuestion = `Who was the top spender in ${context.month}?`;
          break;
        case 3:
          followUpQuestion = `Show me the spending trend for ${context.month}`;
          break;
        case 4:
          followUpQuestion = `Compare ${context.month} with the previous month`;
          break;
        case 5:
          followUpQuestion = `What were the major spending categories in ${context.month}?`;
          break;
        case 6:
          followUpQuestion = `Show me the payment methods used in ${context.month}`;
          break;
      }
    } else if (context.type === "supplier_analysis") {
      switch (option) {
        case 1:
          followUpQuestion = `What is the total spend with ${context.supplier}?`;
          break;
        case 2:
          followUpQuestion = `Show me the monthly breakdown for ${context.supplier}`;
          break;
        case 3:
          followUpQuestion = `Compare ${context.supplier} with other top suppliers`;
          break;
        case 4:
          followUpQuestion = `What are the payment terms with ${context.supplier}?`;
          break;
        case 5:
          followUpQuestion = `Show me the invoice history for ${context.supplier}`;
          break;
        case 6:
          followUpQuestion = `What are the main categories of spend with ${context.supplier}?`;
          break;
      }
    } else if (context.type === "comparison") {
      switch (option) {
        case 1:
          followUpQuestion = `Compare the total spend between ${context.months?.join(" and ")}`;
          break;
        case 2:
          followUpQuestion = `Show me the top suppliers in ${context.months?.join(" and ")}`;
          break;
        case 3:
          followUpQuestion = `Compare the spending categories between ${context.months?.join(" and ")}`;
          break;
        case 4:
          followUpQuestion = `Show me the payment method trends between ${context.months?.join(" and ")}`;
          break;
        case 5:
          followUpQuestion = `Compare the average invoice amounts between ${context.months?.join(" and ")}`;
          break;
        case 6:
          followUpQuestion = `Show me the spending growth rate between ${context.months?.join(" and ")}`;
          break;
      }
    } else {
      switch (option) {
        case 1:
          followUpQuestion = "Show me the top 5 suppliers by spend";
          break;
        case 2:
          followUpQuestion = "What are the major spending categories?";
          break;
        case 3:
          followUpQuestion = "Show me the monthly spending trends";
          break;
        case 4:
          followUpQuestion = "What are the most common payment methods?";
          break;
        case 5:
          followUpQuestion = "Show me the average invoice amounts";
          break;
        case 6:
          followUpQuestion = "What is the total spend for the year?";
          break;
      }
    }
    
    if (followUpQuestion) {
      askQuestion(followUpQuestion);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 overflow-hidden relative">
      {/* Enhanced Background Gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/30 rounded-full mix-blend-multiply blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-1/4 right-1/3 w-72 h-72 bg-indigo-500/30 rounded-full mix-blend-multiply blur-3xl animate-pulse-slow delay-75"></div>
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-purple-500/30 rounded-full mix-blend-multiply blur-3xl animate-pulse-slow delay-150"></div>
        <div className="absolute -bottom-16 right-1/4 w-80 h-80 bg-blue-600/30 rounded-full mix-blend-multiply blur-3xl animate-pulse-slow delay-300"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-multiply blur-3xl animate-pulse-slow delay-200"></div>
      </div>

      <div className="max-w-4xl mx-auto p-6 relative z-10">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">
            Procurement Security Assistant
          </h1>
          <p className="text-xl text-blue-200 font-light">
            Secure Spend Analysis & Monitoring
          </p>
        </header>

        {/* Chat Container */}
        <div className="glass-card p-6 mb-8 max-h-[60vh] overflow-y-auto">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-6 ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block p-4 rounded-2xl max-w-[80%] ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-blue-50'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.role === 'assistant' && message.content.includes("Would you like to:") && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => {
                      const option = message.content.split("\n").find(line => line.startsWith(`${num}.`));
                      if (option) {
                        return (
                          <button
                            key={num}
                            onClick={() => handleFollowUp(num)}
                            className="glass-card p-3 hover:bg-white/20 transition-all duration-200
                                     transform hover:scale-102 text-left text-sm"
                          >
                            <span className="text-blue-50">{option.substring(3)}</span>
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
              <div className={`text-xs text-blue-300 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-left">
              <div className="inline-block p-4 rounded-2xl max-w-[80%] bg-white/10 text-blue-50">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="glass-card p-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && askQuestion(input)}
              placeholder="Ask about supplier spend, monthly statistics, or specific details..."
              className="glass-input flex-1 p-3 rounded-xl"
            />
            <button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl 
                         hover:from-blue-600 hover:to-indigo-700 transform hover:scale-105 
                         transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50
                         disabled:hover:scale-100 flex items-center gap-2"
              onClick={() => askQuestion(input)}
              disabled={loading || !input.trim()}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
} 