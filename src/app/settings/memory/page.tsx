'use client';

/**
 * Memory Dashboard
 *
 * View and manage your AI memory system
 */

import { useState, useEffect } from 'react';
import { Search, Brain, RefreshCw, TrendingUp, Database, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface MemoryStats {
  totalFacts: number;
  factsByType: Record<string, number>;
  recentConsolidations: number;
  lastConsolidation: string | null;
}

interface MemoryFact {
  id: string;
  factType: string;
  content: string;
  confidenceScore: number;
  importanceScore: number;
  createdAt: string;
}

interface SearchResult {
  citation: string;
  snippet: string;
  score: number;
  vectorScore?: number;
  textScore?: number;
}

export default function MemoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [selectedFactType, setSelectedFactType] = useState<string>('all');

  // Load facts and stats on mount
  useEffect(() => {
    loadFacts();
    loadStats();
  }, [selectedFactType]);

  async function loadFacts() {
    try {
      const typeParam = selectedFactType !== 'all' ? `?type=${selectedFactType}` : '';
      const response = await fetch(`/api/memory/facts${typeParam}`);
      if (response.ok) {
        const data = await response.json();
        setFacts(data.facts || []);
      }
    } catch (error) {
      console.error('Error loading facts:', error);
    }
  }

  async function loadStats() {
    // TODO: Create stats endpoint
    setStats({
      totalFacts: facts.length,
      factsByType: {
        preference: 0,
        fact: 0,
        decision: 0,
        context: 0,
        goal: 0,
        skill: 0,
      },
      recentConsolidations: 0,
      lastConsolidation: null,
    });
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching memory:', error);
    } finally {
      setIsSearching(false);
    }
  }

  async function triggerConsolidation() {
    setIsConsolidating(true);
    try {
      const response = await fetch('/api/memory/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Consolidation complete!\n\nFacts extracted: ${data.factsExtracted}\nFacts stored: ${data.factsStored}\nDuration: ${data.duration}ms`);
        loadFacts();
        loadStats();
      }
    } catch (error) {
      console.error('Error triggering consolidation:', error);
      alert('Failed to trigger consolidation');
    } finally {
      setIsConsolidating(false);
    }
  }

  const factTypes = ['all', 'preference', 'fact', 'decision', 'context', 'goal', 'skill'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Memory Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Search and manage your AI memory system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Facts</p>
              <p className="text-3xl font-bold mt-1">{facts.length}</p>
            </div>
            <Brain className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Last Consolidation</p>
              <p className="text-sm font-medium mt-1">
                {stats?.lastConsolidation || 'Never'}
              </p>
            </div>
            <RefreshCw className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Memory Search</p>
              <p className="text-sm font-medium mt-1">Available</p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Search Interface */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Search Memory</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search your memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            <Search className="h-4 w-4 mr-2" />
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <h3 className="font-medium">Results ({searchResults.length})</h3>
            {searchResults.map((result, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">
                      {result.citation}
                    </p>
                    <p className="text-sm">{result.snippet}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className="text-lg font-semibold">{(result.score * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Facts Browser */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Extracted Facts</h2>
          <Button
            onClick={triggerConsolidation}
            disabled={isConsolidating}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isConsolidating ? 'animate-spin' : ''}`} />
            {isConsolidating ? 'Consolidating...' : 'Run Consolidation'}
          </Button>
        </div>

        {/* Fact Type Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {factTypes.map(type => (
            <Button
              key={type}
              variant={selectedFactType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFactType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>

        {/* Facts List */}
        <div className="space-y-3">
          {facts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No facts yet. Have some conversations and run consolidation to extract facts!
            </p>
          ) : (
            facts.map(fact => (
              <Card key={fact.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {fact.factType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {(fact.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm">{fact.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(fact.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <TrendingUp className="h-4 w-4 text-green-500 inline" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(fact.importanceScore * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
