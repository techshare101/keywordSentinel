'use client'

import { Button } from '@/components/ui/button'
import { 
  Search, 
  TrendingUp, 
  Flame, 
  Bell, 
  Target,
  Plus,
  Inbox,
  FileSearch,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-slate-800/50 p-4 mb-4">
        {icon || <Inbox className="h-8 w-8 text-slate-500" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={action.onClick}
          >
            <Plus className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        )
      )}
    </div>
  )
}

export function NoKeywordsEmpty() {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-emerald-400" />}
      title="No keywords yet"
      description="Add your first keyword to start monitoring conversations across the web."
      action={{
        label: "Add Keyword",
        href: "/dashboard/keywords"
      }}
    />
  )
}

export function NoMatchesEmpty() {
  return (
    <EmptyState
      icon={<TrendingUp className="h-8 w-8 text-blue-400" />}
      title="No matches found"
      description="We haven't found any matches yet. Try adding more keywords or wait for the next scan."
      action={{
        label: "Add Keywords",
        href: "/dashboard/keywords"
      }}
    />
  )
}

export function NoLeadsEmpty() {
  return (
    <EmptyState
      icon={<Flame className="h-8 w-8 text-orange-400" />}
      title="No leads discovered"
      description="Hot leads will appear here when we find high-intent conversations matching your keywords."
      action={{
        label: "View Keywords",
        href: "/dashboard/keywords"
      }}
    />
  )
}

export function NoAlertsEmpty() {
  return (
    <EmptyState
      icon={<Bell className="h-8 w-8 text-purple-400" />}
      title="No alerts yet"
      description="Alert history will appear here once notifications are sent for your matches."
    />
  )
}

export function NoCompetitorsEmpty() {
  return (
    <EmptyState
      icon={<Target className="h-8 w-8 text-red-400" />}
      title="No competitors tracked"
      description="Add competitors to monitor their mentions and stay ahead of the market."
      action={{
        label: "Add Competitor",
        href: "/dashboard/competitors"
      }}
    />
  )
}

export function NoSearchResultsEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<FileSearch className="h-8 w-8 text-slate-400" />}
      title="No results found"
      description={`We couldn't find any matches for "${query}". Try a different search term.`}
    />
  )
}

export function NoDataEmpty() {
  return (
    <EmptyState
      icon={<Sparkles className="h-8 w-8 text-yellow-400" />}
      title="No data available"
      description="Data will appear here once scans start running and matches are found."
    />
  )
}

export function FilteredEmpty() {
  return (
    <EmptyState
      icon={<FileSearch className="h-8 w-8 text-slate-400" />}
      title="No matches for this filter"
      description="Try adjusting your filters to see more results."
    />
  )
}
