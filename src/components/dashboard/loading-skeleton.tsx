'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 bg-slate-800" />
          <Skeleton className="h-4 w-72 mt-2 bg-slate-800" />
        </div>
        <Skeleton className="h-10 w-32 bg-slate-800" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 bg-slate-800" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-slate-800" />
          <Skeleton className="h-4 w-64 mt-2 bg-slate-800" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-800" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 bg-slate-800" />
                  <Skeleton className="h-3 w-1/2 mt-2 bg-slate-800" />
                </div>
                <Skeleton className="h-6 w-16 bg-slate-800" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64 bg-slate-800" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 bg-slate-800" />
          <Skeleton className="h-10 w-32 bg-slate-800" />
        </div>
      </div>
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-800">
            {[...Array(rows)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-4 bg-slate-800" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 bg-slate-800" />
                  <Skeleton className="h-3 w-1/2 mt-2 bg-slate-800" />
                </div>
                <Skeleton className="h-6 w-20 bg-slate-800" />
                <Skeleton className="h-6 w-16 bg-slate-800" />
                <Skeleton className="h-8 w-8 bg-slate-800" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="border-slate-800 bg-slate-900">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg bg-slate-800" />
              <Skeleton className="h-5 w-32 bg-slate-800" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Skeleton className="h-3 w-16 bg-slate-800" />
                <Skeleton className="h-6 w-12 mt-1 bg-slate-800" />
              </div>
              <div>
                <Skeleton className="h-3 w-16 bg-slate-800" />
                <Skeleton className="h-6 w-12 mt-1 bg-slate-800" />
              </div>
            </div>
            <Skeleton className="h-2 w-full bg-slate-800" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <Skeleton className="h-6 w-40 bg-slate-800" />
        <Skeleton className="h-4 w-64 mt-2 bg-slate-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full bg-slate-800" />
      </CardContent>
    </Card>
  )
}
