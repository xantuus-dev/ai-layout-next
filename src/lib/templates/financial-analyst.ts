/**
 * Financial Analyst Assistant Template
 *
 * AI agent for financial professionals to automate market research,
 * portfolio analysis, earnings monitoring, and investment reporting.
 */

import { VerticalTemplate } from './types';

export const financialAnalystTemplate: VerticalTemplate = {
  // Identity
  name: 'Financial Analyst Assistant',
  description: 'Automate your financial analysis with AI-powered market research, earnings tracking, portfolio monitoring, and comprehensive investment reports. Perfect for analysts, advisors, and portfolio managers.',
  industry: 'finance',
  icon: '📊',
  color: '#059669', // Green

  // Agent configuration
  agentType: 'research',
  systemPrompt: `You are a Financial Analyst Assistant AI specialized in helping financial professionals conduct research, analyze investments, and generate insights.

Your core responsibilities:
- Monitor stock prices, market trends, and financial news
- Track earnings reports and quarterly filings (10-Q, 10-K)
- Analyze company fundamentals (P/E, revenue growth, profit margins)
- Research competitor analysis and industry trends
- Generate portfolio performance reports
- Calculate investment metrics (ROI, Sharpe ratio, alpha, beta)
- Summarize SEC filings and earnings call transcripts
- Monitor macroeconomic indicators and central bank policy

You have access to research, data processing, and communication tools. When analyzing investments:
1. Gather data from multiple reliable sources
2. Calculate key financial ratios and metrics
3. Compare against industry benchmarks and peers
4. Identify trends, risks, and opportunities
5. Provide objective, data-driven insights and recommendations
6. Cite sources and show your calculation methodology

Be analytical, objective, and always include disclaimers that this is research assistance, not financial advice. Focus on data accuracy and clear communication of complex financial concepts.`,
  suggestedModel: 'claude-opus-4-5-20251101', // Use Opus for sophisticated financial analysis

  // Requirements
  requiredTools: ['browser', 'http', 'ai', 'data'],
  optionalTools: ['email', 'drive'],
  requiredIntegrations: [],

  // Sample workflows
  sampleWorkflows: [
    {
      id: 'stock-monitoring',
      name: 'Stock Price & News Monitoring',
      description: 'Monitor watchlist stocks for price changes and significant news',
      trigger: 'scheduled',
      schedule: '0 */2 9-16 * * 1-5', // Every 2 hours during market hours (Mon-Fri)
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch current prices for watchlist',
          params: {
            url: '{{market_data_api}}/quotes',
            query: {
              symbols: '{{watchlist_symbols}}',
            },
            headers: {
              Authorization: 'Bearer {{api_key}}',
            },
          },
          estimatedCredits: 30,
        },
        {
          order: 2,
          tool: 'data.compare',
          description: 'Calculate price changes',
          params: {
            operation: 'price_change',
            current_prices: '{{current_quotes}}',
            previous_prices: '{{last_prices}}',
          },
          estimatedCredits: 20,
        },
        {
          order: 3,
          tool: 'browser.search',
          description: 'Search for recent news on stocks with significant moves',
          params: {
            query: '{{ticker_symbol}} stock news today',
            limit: 5,
          },
          estimatedCredits: 60,
        },
        {
          order: 4,
          tool: 'ai.summarize',
          description: 'Summarize news and potential impact',
          params: {
            content: '{{news_articles}}',
            prompt: 'Summarize the key news for {{ticker_symbol}} and assess potential impact on stock price (bullish/bearish/neutral). Focus on material information.',
          },
          estimatedCredits: 150,
        },
        {
          order: 5,
          tool: 'email.send',
          description: 'Send alert for significant changes',
          params: {
            to: '{{analyst_email}}',
            subject: 'Watchlist Alert: {{count}} significant moves - {{date}}',
            body: '{{price_changes_summary}}\n\n{{news_summaries}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
    {
      id: 'earnings-analysis',
      name: 'Earnings Report Analysis',
      description: 'Analyze quarterly earnings reports and extract key insights',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Search for earnings press release',
          params: {
            query: '{{company_name}} {{ticker}} Q{{quarter}} {{year}} earnings press release',
            limit: 3,
          },
          estimatedCredits: 50,
        },
        {
          order: 2,
          tool: 'browser.navigate',
          description: 'Navigate to earnings release',
          params: {
            url: '{{press_release_url}}',
          },
          estimatedCredits: 40,
        },
        {
          order: 3,
          tool: 'browser.extract',
          description: 'Extract earnings text',
          params: {
            selector: 'body',
            format: 'text',
          },
          estimatedCredits: 30,
        },
        {
          order: 4,
          tool: 'ai.analyze',
          description: 'Extract key financial metrics',
          params: {
            prompt: 'Extract from this earnings release: 1) Revenue (actual vs guidance vs prior year), 2) EPS (actual vs consensus vs prior year), 3) Gross margin %, 4) Operating margin %, 5) Free cash flow, 6) Guidance for next quarter. Format as structured data. Earnings text: {{earnings_text}}',
          },
          estimatedCredits: 200,
        },
        {
          order: 5,
          tool: 'browser.search',
          description: 'Search for earnings call transcript',
          params: {
            query: '{{company_name}} Q{{quarter}} {{year}} earnings call transcript',
            limit: 3,
          },
          estimatedCredits: 50,
        },
        {
          order: 6,
          tool: 'browser.extract',
          description: 'Extract transcript',
          params: {
            selector: '{{transcript_selector}}',
          },
          estimatedCredits: 60,
        },
        {
          order: 7,
          tool: 'ai.analyze',
          description: 'Analyze management commentary and Q&A',
          params: {
            prompt: 'Analyze this earnings call transcript. Identify: 1) Management tone (optimistic/cautious/defensive), 2) Key strategic priorities, 3) Headwinds mentioned, 4) Growth drivers highlighted, 5) Questions/concerns from analysts, 6) Notable quotes from CEO/CFO. Transcript: {{transcript}}',
          },
          estimatedCredits: 400,
        },
        {
          order: 8,
          tool: 'ai.generate',
          description: 'Generate earnings summary report',
          params: {
            prompt: 'Create a comprehensive earnings analysis report for {{company_name}} ({{ticker}}) Q{{quarter}} {{year}}. Include: Executive Summary, Financial Performance vs Expectations, Management Commentary Highlights, Key Takeaways, Investment Thesis Impact (bullish/bearish points). Use this data: {{financial_metrics}} {{call_analysis}}',
          },
          estimatedCredits: 500,
        },
        {
          order: 9,
          tool: 'drive.createDoc',
          description: 'Save earnings analysis',
          params: {
            title: '{{ticker}} Earnings Analysis - Q{{quarter}} {{year}}',
            content: '{{earnings_report}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'portfolio-analysis',
      name: 'Portfolio Performance Analysis',
      description: 'Generate comprehensive portfolio performance report',
      trigger: 'scheduled',
      schedule: '0 17 * * 5', // Every Friday at 5 PM
      steps: [
        {
          order: 1,
          tool: 'http.get',
          description: 'Fetch portfolio holdings',
          params: {
            url: '{{portfolio_api}}/holdings',
            headers: {
              Authorization: 'Bearer {{api_key}}',
            },
          },
          estimatedCredits: 20,
        },
        {
          order: 2,
          tool: 'http.get',
          description: 'Fetch current market prices',
          params: {
            url: '{{market_data_api}}/quotes',
            query: {
              symbols: '{{portfolio_symbols}}',
            },
          },
          estimatedCredits: 30,
        },
        {
          order: 3,
          tool: 'data.calculate',
          description: 'Calculate portfolio metrics',
          params: {
            operations: [
              'total_value',
              'total_return_pct',
              'daily_change',
              'weekly_change',
              'mtd_change',
              'ytd_change',
            ],
            holdings: '{{holdings_data}}',
            prices: '{{current_prices}}',
          },
          estimatedCredits: 50,
        },
        {
          order: 4,
          tool: 'data.analyze',
          description: 'Analyze asset allocation',
          params: {
            analysis: 'asset_allocation',
            groupBy: ['sector', 'asset_class', 'geography'],
          },
          estimatedCredits: 40,
        },
        {
          order: 5,
          tool: 'ai.analyze',
          description: 'Identify top performers and laggards',
          params: {
            prompt: 'Analyze this portfolio performance data. Identify: 1) Top 5 performers (by return %), 2) Bottom 5 performers, 3) Overweight/underweight positions vs benchmark, 4) Concentration risk (any position >10%), 5) Recommended rebalancing actions. Portfolio data: {{portfolio_metrics}} {{allocation_data}}',
          },
          estimatedCredits: 250,
        },
        {
          order: 6,
          tool: 'browser.search',
          description: 'Research significant movers',
          params: {
            query: '{{top_performers}} {{bottom_performers}} stock news this week',
            limit: 10,
          },
          estimatedCredits: 80,
        },
        {
          order: 7,
          tool: 'ai.generate',
          description: 'Generate portfolio report',
          params: {
            prompt: 'Create a professional portfolio performance report for the week of {{date}}. Include: 1) Executive Summary, 2) Performance Metrics (total return, daily/weekly/monthly/YTD), 3) Asset Allocation Chart, 4) Top Movers Analysis, 5) Portfolio Health Check, 6) Recommendations. Use this data: {{all_metrics}} {{news_context}}',
          },
          estimatedCredits: 500,
        },
        {
          order: 8,
          tool: 'email.send',
          description: 'Email weekly report',
          params: {
            to: '{{client_emails}}',
            subject: 'Weekly Portfolio Report - {{date}}',
            body: '{{portfolio_report}}',
            attachments: ['{{report_pdf}}'],
          },
          estimatedCredits: 10,
        },
      ],
    },
    {
      id: 'company-research',
      name: 'Company Deep Dive Research',
      description: 'Comprehensive fundamental analysis of a company',
      trigger: 'manual',
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Search for company overview',
          params: {
            query: '{{company_name}} {{ticker}} investor relations',
            limit: 5,
          },
          estimatedCredits: 50,
        },
        {
          order: 2,
          tool: 'browser.navigate',
          description: 'Navigate to SEC EDGAR filings',
          params: {
            url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={{ticker}}&type=10-K&dateb=&owner=exclude&count=1',
          },
          estimatedCredits: 40,
        },
        {
          order: 3,
          tool: 'browser.extract',
          description: 'Extract latest 10-K filing',
          params: {
            selector: '.tableFile',
            extractLinks: true,
          },
          estimatedCredits: 50,
        },
        {
          order: 4,
          tool: 'ai.summarize',
          description: 'Summarize business model and risks',
          params: {
            content: '{{filing_sections}}',
            prompt: 'Summarize: 1) Business model and revenue streams, 2) Competitive advantages, 3) Key risk factors, 4) Growth strategy. Focus on material information from 10-K.',
          },
          estimatedCredits: 300,
        },
        {
          order: 5,
          tool: 'http.get',
          description: 'Fetch financial data API',
          params: {
            url: '{{financial_data_api}}/fundamentals/{{ticker}}',
            query: {
              years: 5,
              metrics: 'revenue,net_income,free_cash_flow,debt,assets,pe_ratio,roe,roic',
            },
          },
          estimatedCredits: 30,
        },
        {
          order: 6,
          tool: 'ai.analyze',
          description: 'Analyze financial trends',
          params: {
            prompt: 'Analyze 5-year financial trends for {{company_name}}. Calculate: 1) Revenue CAGR, 2) Profit margin trends, 3) Free cash flow growth, 4) Debt/equity trend, 5) Return on equity trend. Identify if company is growing, stable, or declining. Financial data: {{historical_financials}}',
          },
          estimatedCredits: 250,
        },
        {
          order: 7,
          tool: 'browser.search',
          description: 'Research competitors',
          params: {
            query: '{{company_name}} competitors {{industry}}',
            limit: 10,
          },
          estimatedCredits: 60,
        },
        {
          order: 8,
          tool: 'ai.analyze',
          description: 'Competitive positioning analysis',
          params: {
            prompt: 'Analyze {{company_name}} competitive position in {{industry}}. Compare: 1) Market share, 2) Growth rates vs peers, 3) Profit margins vs industry average, 4) Valuation multiples vs peers, 5) Competitive advantages/disadvantages. Competitor data: {{competitor_info}}',
          },
          estimatedCredits: 300,
        },
        {
          order: 9,
          tool: 'ai.generate',
          description: 'Generate investment thesis',
          params: {
            prompt: 'Create a comprehensive investment research report for {{company_name}} ({{ticker}}). Include: 1) Company Overview, 2) Business Model Analysis, 3) Financial Performance (5-year trends), 4) Competitive Position, 5) Key Risks, 6) Valuation Analysis, 7) Investment Recommendation (Buy/Hold/Sell with price target). Use all gathered data: {{all_research_data}}',
          },
          estimatedCredits: 600,
        },
        {
          order: 10,
          tool: 'drive.createDoc',
          description: 'Save research report',
          params: {
            title: '{{ticker}} Investment Research Report - {{date}}',
            content: '{{investment_thesis}}',
          },
          estimatedCredits: 20,
        },
      ],
    },
    {
      id: 'macro-monitoring',
      name: 'Macroeconomic Indicators Monitor',
      description: 'Track key economic indicators and central bank policy',
      trigger: 'scheduled',
      schedule: '0 8 * * 1', // Every Monday at 8 AM
      steps: [
        {
          order: 1,
          tool: 'browser.search',
          description: 'Search for recent economic data releases',
          params: {
            query: 'GDP inflation unemployment CPI PPI interest rates economic data this week',
            limit: 15,
          },
          estimatedCredits: 80,
        },
        {
          order: 2,
          tool: 'browser.search',
          description: 'Search for Federal Reserve news',
          params: {
            query: 'Federal Reserve FOMC interest rate policy decision',
            limit: 10,
          },
          estimatedCredits: 60,
        },
        {
          order: 3,
          tool: 'ai.summarize',
          description: 'Summarize economic data',
          params: {
            content: '{{economic_news}}',
            prompt: 'Summarize key macroeconomic data from this week: 1) GDP growth, 2) Inflation (CPI/PPI), 3) Unemployment rate, 4) Consumer spending, 5) Manufacturing data. Identify if economy is strengthening, weakening, or stable.',
          },
          estimatedCredits: 200,
        },
        {
          order: 4,
          tool: 'ai.analyze',
          description: 'Analyze Fed policy implications',
          params: {
            prompt: 'Analyze Federal Reserve monetary policy based on recent statements and data: {{fed_news}}. Assess: 1) Current interest rate trajectory (hawkish/dovish), 2) Likely next policy move, 3) Impact on bond yields, 4) Impact on equity markets, 5) Impact on dollar strength.',
          },
          estimatedCredits: 250,
        },
        {
          order: 5,
          tool: 'ai.generate',
          description: 'Generate macro outlook report',
          params: {
            prompt: 'Create a weekly macroeconomic outlook report. Include: 1) Economic Summary (key data points), 2) Central Bank Policy Analysis, 3) Market Implications (equities, bonds, currencies), 4) Key Risks to Watch, 5) Investment Positioning Recommendations. Use data: {{economic_summary}} {{fed_analysis}}',
          },
          estimatedCredits: 400,
        },
        {
          order: 6,
          tool: 'email.send',
          description: 'Send macro outlook',
          params: {
            to: '{{analyst_email}}',
            subject: 'Weekly Macro Outlook - {{date}}',
            body: '{{macro_report}}',
          },
          estimatedCredits: 5,
        },
      ],
    },
  ],

  // Custom instructions template
  customInstructionsTemplate: `Investment Focus:
- Investment Strategy: [Value/Growth/Income/Balanced]
- Asset Classes: [Stocks/Bonds/Commodities/Crypto/Real Estate]
- Geographic Focus: [US/International/Emerging Markets]
- Market Cap Preference: [Large/Mid/Small Cap]

Watchlist & Portfolio:
- Watchlist Symbols: [Ticker symbols comma-separated]
- Portfolio Holdings: [If tracking a portfolio]
- Benchmark Index: [S&P 500/NASDAQ/Russell 2000/etc]

Data Sources:
- Market Data API: [Your API endpoint]
- API Key: [Your API key]
- Preferred News Sources: [Bloomberg/WSJ/FT/Reuters]

Analysis Preferences:
- Report Frequency: [Daily/Weekly/Monthly]
- Key Metrics: [P/E, P/B, ROE, debt/equity, etc]
- Alert Thresholds: [e.g., price change >5%, volume spike >2x]

Disclaimer:
This assistant provides research and analysis only. All outputs are for informational purposes and do not constitute financial advice. Always conduct your own due diligence and consult a licensed financial advisor before making investment decisions.`,

  // Success metrics
  suggestedKPIs: [
    'Research reports generated per week',
    'Portfolio return vs benchmark',
    'Time saved on earnings analysis',
    'News alerts actioned',
    'Investment ideas researched',
    'Analysis accuracy rate',
  ],

  // Default configuration
  defaultConfig: {
    maxSteps: 35,
    maxCreditsPerTask: 1500, // Financial analysis can be credit-intensive
    timeoutSeconds: 900, // 15 minutes for deep research
    retryAttempts: 2,
    requireApproval: true, // Review analysis before sending to clients
  },

  // Tier and visibility
  tier: 'core', // Available to Core+ tiers (professional use case)
  featured: true,
  order: 5,
};
