'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign,
  Globe,
  Mail,
  Clock,
  TrendingDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Trash2,
  Eye,
} from 'lucide-react';

interface PriceMonitor {
  id: string;
  title: string;
  status: string;
  competitorUrl: string;
  thresholdPrice: number;
  lastRun?: string;
  lastResult?: any;
  creditsUsed: number;
  createdAt: string;
}

export default function PriceMonitorPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Form state
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [priceSelector, setPriceSelector] = useState('.price');
  const [thresholdPrice, setThresholdPrice] = useState('99.99');
  const [alertEmail, setAlertEmail] = useState('');
  const [checkFrequency, setCheckFrequency] = useState('daily');
  const [checkTime, setCheckTime] = useState('09:00');

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [monitors, setMonitors] = useState<PriceMonitor[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [sessionStatus, router]);

  // Load existing monitors
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchMonitors();
    }
  }, [sessionStatus]);

  const fetchMonitors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows/price-monitor');
      if (response.ok) {
        const data = await response.json();
        setMonitors(data.monitors || []);
      }
    } catch (error) {
      console.error('Failed to fetch monitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/workflows/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorUrl,
          priceSelector,
          thresholdPrice: parseFloat(thresholdPrice),
          alertEmail: alertEmail || session?.user?.email,
          checkFrequency,
          checkTime,
          runNow: true, // Run immediately
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create monitor');
      }

      setSuccess(true);

      // Reset form
      setCompetitorUrl('');
      setPriceSelector('.price');
      setThresholdPrice('99.99');
      setAlertEmail('');

      // Refresh monitors list
      setTimeout(() => {
        fetchMonitors();
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRunMonitor = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/price-monitor/${id}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh monitors after a delay
        setTimeout(fetchMonitors, 3000);
      }
    } catch (error) {
      console.error('Failed to run monitor:', error);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price monitor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/price-monitor/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchMonitors();
      }
    } catch (error) {
      console.error('Failed to delete monitor:', error);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Competitor Price Monitor</h1>
        <p className="text-muted-foreground">
          Automatically track competitor pricing and get alerts when prices drop below your threshold.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Setup Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Price Monitor</CardTitle>
            <CardDescription>
              Set up automatic monitoring of competitor prices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="competitorUrl">
                  <Globe className="inline h-4 w-4 mr-2" />
                  Competitor URL
                </Label>
                <Input
                  id="competitorUrl"
                  type="url"
                  placeholder="https://competitor.com/pricing"
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Full URL to the competitor's pricing page
                </p>
              </div>

              <div>
                <Label htmlFor="priceSelector">CSS Selector</Label>
                <Input
                  id="priceSelector"
                  placeholder=".price, #price, .product-price"
                  value={priceSelector}
                  onChange={(e) => setPriceSelector(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  CSS selector for the price element (e.g., .price-value)
                </p>
              </div>

              <div>
                <Label htmlFor="thresholdPrice">
                  <DollarSign className="inline h-4 w-4 mr-2" />
                  Alert Threshold
                </Label>
                <Input
                  id="thresholdPrice"
                  type="number"
                  step="0.01"
                  placeholder="99.99"
                  value={thresholdPrice}
                  onChange={(e) => setThresholdPrice(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert me if competitor price drops below this
                </p>
              </div>

              <div>
                <Label htmlFor="alertEmail">
                  <Mail className="inline h-4 w-4 mr-2" />
                  Alert Email
                </Label>
                <Input
                  id="alertEmail"
                  type="email"
                  placeholder={session?.user?.email || 'your@email.com'}
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to use your account email
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="checkFrequency">
                    <Clock className="inline h-4 w-4 mr-2" />
                    Frequency
                  </Label>
                  <Select value={checkFrequency} onValueChange={setCheckFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="checkTime">Check Time</Label>
                  <Input
                    id="checkTime"
                    type="time"
                    value={checkTime}
                    onChange={(e) => setCheckTime(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Price monitor created! Running first check now...
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Monitor...
                  </>
                ) : (
                  <>
                    <TrendingDown className="mr-2 h-4 w-4" />
                    Create Price Monitor
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              💰 Cost: ~200 credits per check | 6,000 credits/month for daily monitoring
            </p>
          </CardFooter>
        </Card>

        {/* Active Monitors */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Price Monitors</h2>

          {monitors.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No price monitors yet.</p>
                <p className="text-sm">Create one to get started!</p>
              </CardContent>
            </Card>
          ) : (
            monitors.map((monitor) => (
              <Card key={monitor.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{monitor.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {monitor.competitorUrl}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {monitor.status === 'executing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {monitor.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {monitor.status === 'failed' && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Threshold:</span>
                      <span className="font-medium">${monitor.thresholdPrice}</span>
                    </div>
                    {monitor.lastRun && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Check:</span>
                        <span>{new Date(monitor.lastRun).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits Used:</span>
                      <span>{monitor.creditsUsed}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunMonitor(monitor.id)}
                    disabled={monitor.status === 'executing'}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/workflows/price-monitor/${monitor.id}`)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteMonitor(monitor.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* How It Works */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-semibold mb-2">1. Monitor Setup</div>
              <p className="text-muted-foreground">
                Enter competitor URL, price selector, and alert threshold
              </p>
            </div>
            <div>
              <div className="font-semibold mb-2">2. Automatic Check</div>
              <p className="text-muted-foreground">
                AI agent visits page and extracts current price
              </p>
            </div>
            <div>
              <div className="font-semibold mb-2">3. Smart Comparison</div>
              <p className="text-muted-foreground">
                Compares price to your threshold using AI reasoning
              </p>
            </div>
            <div>
              <div className="font-semibold mb-2">4. Instant Alert</div>
              <p className="text-muted-foreground">
                Email sent immediately if price drops below threshold
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
