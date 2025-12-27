'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function StatCardSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24 bg-slate-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 bg-slate-800 mb-2" />
        <Skeleton className="h-3 w-20 bg-slate-800" />
      </CardContent>
    </Card>
  )
}

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

export function MatchCardSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-lg bg-slate-800 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4 bg-slate-800" />
            <Skeleton className="h-4 w-full bg-slate-800" />
            <Skeleton className="h-4 w-2/3 bg-slate-800" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-16 rounded-full bg-slate-800" />
              <Skeleton className="h-6 w-20 rounded-full bg-slate-800" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MatchListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <Skeleton className="h-5 w-32 bg-slate-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-48 w-full bg-slate-800 rounded-lg" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <Skeleton className="h-5 w-40 bg-slate-800" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex gap-4 pb-2 border-b border-slate-800">
            <Skeleton className="h-4 w-1/4 bg-slate-800" />
            <Skeleton className="h-4 w-1/4 bg-slate-800" />
            <Skeleton className="h-4 w-1/4 bg-slate-800" />
            <Skeleton className="h-4 w-1/4 bg-slate-800" />
          </div>
          {/* Rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              <Skeleton className="h-4 w-1/4 bg-slate-800" />
              <Skeleton className="h-4 w-1/4 bg-slate-800" />
              <Skeleton className="h-4 w-1/4 bg-slate-800" />
              <Skeleton className="h-4 w-1/4 bg-slate-800" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function KeywordCardSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32 bg-slate-800" />
            <Skeleton className="h-4 w-24 bg-slate-800" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded bg-slate-800" />
            <Skeleton className="h-8 w-8 rounded bg-slate-800" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48 bg-slate-800 mb-2" />
          <Skeleton className="h-4 w-64 bg-slate-800" />
        </div>
        <Skeleton className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>

      {/* Stats Grid */}
      <StatsGridSkeleton />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Recent Matches */}
      <div>
        <Skeleton className="h-6 w-40 bg-slate-800 mb-4" />
        <MatchListSkeleton count={3} />
      </div>
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <Skeleton className="h-8 w-48 bg-slate-800 mb-2" />
        <Skeleton className="h-4 w-64 bg-slate-800" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 bg-slate-800 rounded-lg" />
        <Skeleton className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>
    </div>
  )
}
