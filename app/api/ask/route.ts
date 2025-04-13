import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SpendEntry {
  "Supplier Name": string;
  "Month": string;
  "Year": number;
  "Spend (£)": number;
  "Invoice ID": string;
}

interface SupplierEntry {
  "Supplier Name": string;
  "Contact Person (Supplier)": string;
  "Owner Email": string;
  "Owner Tel Number": string;
}

// Common variations and misspellings
const variations = {
  email: ['email', 'e-mail', 'mail', 'emaill', 'e mail', 'emial'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'number', 'fone', 'phon'],
  contact: ['contact', 'person', 'who', 'contct', 'cantact'],
  monthly: ['monthly', 'month', 'months', 'monthley', 'montly', 'every month'],
  total: ['total', 'all', 'sum', 'overall', 'totall', 'totel'],
  spend: ['spend', 'spent', 'cost', 'payment', 'amount', 'spnd', 'expens'],
  supplier: ['supplier', 'vendor', 'company', 'business', 'suplier', 'supplyer']
};

function matchesVariation(text: string, type: keyof typeof variations): boolean {
  return variations[type].some(variant => text.includes(variant));
}

function findSupplierInText(text: string, suppliers: SupplierEntry[]): SupplierEntry | undefined {
  // First try exact match
  const exactMatch = suppliers.find(s => 
    text.includes(s["Supplier Name"].toLowerCase())
  );
  if (exactMatch) return exactMatch;

  // Try fuzzy match
  for (const supplier of suppliers) {
    const supplierWords = supplier["Supplier Name"].toLowerCase().split(' ');
    const matchCount = supplierWords.filter(word => text.includes(word)).length;
    if (matchCount >= Math.ceil(supplierWords.length / 2)) {
      return supplier;
    }
  }

  return undefined;
}

function findMonthInText(text: string): string | undefined {
  const months = {
    january: ['january', 'jan', 'januery'],
    february: ['february', 'feb', 'feburary', 'febraury'],
    march: ['march', 'mar', 'march'],
    april: ['april', 'apr', 'aprl'],
    may: ['may'],
    june: ['june', 'jun'],
    july: ['july', 'jul'],
    august: ['august', 'aug'],
    september: ['september', 'sep', 'sept'],
    october: ['october', 'oct'],
    november: ['november', 'nov'],
    december: ['december', 'dec']
  };

  for (const [month, variations] of Object.entries(months)) {
    if (variations.some(v => text.includes(v))) {
      return month.charAt(0).toUpperCase() + month.slice(1);
    }
  }

  return undefined;
}

function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString()}`;
}

function calculateTotalSpend(spend: SpendEntry[], filters: {
  supplierName?: string;
  month?: string;
  year?: number;
} = {}): number {
  return spend.reduce((total, entry) => {
    if (
      (!filters.supplierName || entry["Supplier Name"].toLowerCase().includes(filters.supplierName.toLowerCase())) &&
      (!filters.month || entry["Month"] === filters.month) &&
      (!filters.year || entry["Year"] === filters.year)
    ) {
      return total + entry["Spend (£)"];
    }
    return total;
  }, 0);
}

function getMonthlySpend(spend: SpendEntry[], supplierName: string): { month: string; amount: number }[] {
  const monthlyData = spend
    .filter(entry => entry["Supplier Name"].toLowerCase().includes(supplierName.toLowerCase()))
    .map(entry => ({
      month: entry["Month"],
      amount: entry["Spend (£)"]
    }));

  return monthlyData.sort((a, b) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months.indexOf(a.month) - months.indexOf(b.month);
  });
}

function getTopSuppliers(spend: SpendEntry[], count: number = 3): { name: string; total: number }[] {
  const totals = new Map<string, number>();
  
  // Calculate total spend for each supplier
  spend.forEach(entry => {
    const current = totals.get(entry["Supplier Name"]) || 0;
    totals.set(entry["Supplier Name"], current + entry["Spend (£)"]);
  });

  // Convert to array and sort
  return Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, count);
}

async function askDeepSeek(prompt: string): Promise<string> {
  try {
    const systemPrompt = `You are a procurement assistant. Your task is to analyze procurement data and answer questions accurately.
The data contains supplier information, spend data, and invoice data.

Question: ${prompt}

Please provide a clear, direct answer based on the data. If you can't find the exact information, say so.`;

    const { stdout } = await execAsync(`ollama run deepseek-r1:1.5b "${systemPrompt.replace(/"/g, '\\"')}"`);
    return stdout.trim();
  } catch (error) {
    console.error('DeepSeek error:', error);
    throw error;
  }
}

function loadExcelData() {
  try {
    const filePath = path.join(process.env.HOME || "", "Desktop", "procurement_data.xlsx");
    console.log("Looking for Excel file at:", filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}. Please place procurement_data.xlsx on your desktop.`);
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    console.log("Excel file found, size:", fileBuffer.length, "bytes");
    
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    console.log("Workbook sheets:", Object.keys(workbook.Sheets));

    const suppliers = XLSX.utils.sheet_to_json(workbook.Sheets["Sheet1"]);
    const spend = XLSX.utils.sheet_to_json(workbook.Sheets["Spend Tracker"]);
    const invoices = XLSX.utils.sheet_to_json(workbook.Sheets["Yearly Supplier Summary"]);

    console.log("Data loaded:", {
      suppliersCount: suppliers.length,
      spendCount: spend.length,
      invoicesCount: invoices.length
    });

    return { suppliers, spend, invoices };
  } catch (error) {
    console.error("Error loading Excel data:", error);
    throw error;
  }
}

function getMonthlyStatistics(spend: SpendEntry[]): { month: string; average: number; topSupplier: string; topAmount: number; count: number }[] {
  const monthlyData = new Map<string, { total: number; count: number; suppliers: Map<string, number> }>();
  
  // Calculate monthly totals and supplier spends
  spend.forEach(entry => {
    const month = entry["Month"];
    const amount = entry["Spend (£)"];
    const supplier = entry["Supplier Name"];
    
    if (!monthlyData.has(month)) {
      monthlyData.set(month, { total: 0, count: 0, suppliers: new Map() });
    }
    
    const data = monthlyData.get(month)!;
    data.total += amount;
    data.count += 1;
    
    const supplierTotal = data.suppliers.get(supplier) || 0;
    data.suppliers.set(supplier, supplierTotal + amount);
  });

  // Calculate statistics for each month
  return Array.from(monthlyData.entries()).map(([month, data]) => {
    const average = data.total / data.count;
    
    // Find top supplier for the month
    let topSupplier = "";
    let topAmount = 0;
    data.suppliers.forEach((amount, supplier) => {
      if (amount > topAmount) {
        topAmount = amount;
        topSupplier = supplier;
      }
    });

    return {
      month,
      average,
      topSupplier,
      topAmount,
      count: data.count
    };
  }).sort((a, b) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months.indexOf(a.month) - months.indexOf(b.month);
  });
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    const q = question.toLowerCase();
    const { suppliers, spend, invoices } = loadExcelData();

    // Handle specific month queries
    const month = findMonthInText(q);
    if (month && (q.includes("performance") || q.includes("details") || q.includes("tell me") || q.includes("show me"))) {
      const monthlyStats = getMonthlyStatistics(spend as SpendEntry[]);
      const stat = monthlyStats.find(s => s.month === month);
      
      if (stat) {
        const monthSpend = calculateTotalSpend(spend as SpendEntry[], { month });
        const response = `Let me break down ${month}'s performance for you:\n\n` +
          `• Total spend for the month was ${formatCurrency(monthSpend)}\n` +
          `• We processed ${stat.count} transactions\n` +
          `• The average transaction value was ${formatCurrency(stat.average)}\n` +
          `• ${stat.topSupplier} led the spending with ${formatCurrency(stat.topAmount)}\n\n` +
          `Would you like to:\n` +
          `1. Compare this with another month?\n` +
          `2. See more details about ${stat.topSupplier}'s performance?\n` +
          `3. Look at the spending trend over time?`;
        
        return NextResponse.json({ 
          answer: response,
          context: {
            month,
            topSupplier: stat.topSupplier,
            totalSpend: monthSpend
          }
        });
      }
    }

    // Handle monthly statistics queries
    if (q.includes("statistics") || q.includes("monthly") || (q.includes("show") && q.includes("all"))) {
      const monthlyStats = getMonthlyStatistics(spend as SpendEntry[]);
      let response = "Here's a summary of the monthly statistics:\n\n";
      
      monthlyStats.forEach(stat => {
        response += `In ${stat.month}:\n`;
        response += `• The average spend was ${formatCurrency(stat.average)}\n`;
        response += `• ${stat.topSupplier} was the top spender with ${formatCurrency(stat.topAmount)}\n\n`;
      });

      response += "Would you like to:\n" +
        "1. Dive deeper into a particular month's performance?\n" +
        "2. Compare how two months stack up against each other?\n" +
        "3. See how spending patterns have evolved over time?\n" +
        "4. Get more details about any specific supplier's performance?";

      return NextResponse.json({ 
        answer: response,
        context: {
          type: "monthly_statistics"
        }
      });
    }

    // Handle supplier queries
    const supplier = findSupplierInText(q, suppliers as SupplierEntry[]);
    if (supplier) {
      const monthlySpend = getMonthlySpend(spend as SpendEntry[], supplier["Supplier Name"]);
      const totalSpend = calculateTotalSpend(spend as SpendEntry[], { supplierName: supplier["Supplier Name"] });
      
      const response = `Here's what I found about ${supplier["Supplier Name"]}:\n\n` +
        `• Contact Person: ${supplier["Contact Person (Supplier)"]}\n` +
        `• Email: ${supplier["Owner Email"]}\n` +
        `• Phone: ${supplier["Owner Tel Number"]}\n` +
        `• Total spend to date: ${formatCurrency(totalSpend)}\n\n` +
        `Monthly breakdown:\n` +
        monthlySpend.map(ms => `• ${ms.month}: ${formatCurrency(ms.amount)}`).join('\n') + '\n\n' +
        `Would you like to:\n` +
        `1. Compare with another supplier?\n` +
        `2. See how they rank among top spenders?\n` +
        `3. Get more details about a specific month?`;

      return NextResponse.json({ 
        answer: response,
        context: {
          supplier: supplier["Supplier Name"],
          totalSpend
        }
      });
    }

    // Handle comparison queries
    if (q.includes("compare") || q.includes("vs") || q.includes("versus")) {
      const monthlyStats = getMonthlyStatistics(spend as SpendEntry[]);
      const months = monthlyStats.filter(s => q.includes(s.month.toLowerCase()));
      
      if (months.length === 2) {
        const response = `Let's compare ${months[0].month} and ${months[1].month}:\n\n` +
          `• Average spend:\n` +
          `  ${months[0].month}: ${formatCurrency(months[0].average)}\n` +
          `  ${months[1].month}: ${formatCurrency(months[1].average)}\n\n` +
          `• Top spenders:\n` +
          `  ${months[0].month}: ${months[0].topSupplier} (${formatCurrency(months[0].topAmount)})\n` +
          `  ${months[1].month}: ${months[1].topSupplier} (${formatCurrency(months[1].topAmount)})\n\n` +
          `• Number of transactions:\n` +
          `  ${months[0].month}: ${months[0].count}\n` +
          `  ${months[1].month}: ${months[1].count}\n\n` +
          `Would you like to:\n` +
          `1. See more details about either month?\n` +
          `2. Compare with a different month?\n` +
          `3. Look at the overall trend?`;

        return NextResponse.json({ 
          answer: response,
          context: {
            type: "comparison",
            months: [months[0].month, months[1].month]
          }
        });
      }
    }

    // Handle trend queries
    if (q.includes("trend") || q.includes("pattern") || q.includes("over time")) {
      const monthlyStats = getMonthlyStatistics(spend as SpendEntry[]);
      const response = "Here's how spending has trended over time:\n\n" +
        monthlyStats.map(stat => 
          `• ${stat.month}: Average ${formatCurrency(stat.average)} (Led by ${stat.topSupplier})`
        ).join("\n") + "\n\n" +
        `Would you like to:\n` +
        `1. Focus on a specific month's performance?\n` +
        `2. Compare any two months in detail?\n` +
        `3. See more about our top suppliers?`;

      return NextResponse.json({ 
        answer: response,
        context: {
          type: "trend"
        }
      });
    }

    // Default response with top suppliers
    const topSuppliers = getTopSuppliers(spend as SpendEntry[], 5);
    const response = "I'm not sure what specific information you're looking for. Here are our top 5 suppliers by spend:\n\n" +
      topSuppliers.map((s, i) => `${i + 1}. ${s.name}: ${formatCurrency(s.total)}`).join('\n') + '\n\n' +
      `Would you like to:\n` +
      `1. Get details about a specific supplier?\n` +
      `2. See monthly statistics?\n` +
      `3. Look at spending trends over time?`;

    return NextResponse.json({ 
      answer: response,
      context: {
        type: "default"
      }
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      error: "Sorry, I encountered an error while processing your request. Please try again." 
    }, { status: 500 });
  }
} 