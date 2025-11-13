'use client';

import Link from 'next/link';
import { UserCog, CheckCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuperAdminHubPage() {
  return (
    <div className="p-4 md:p-8 flex-1 flex items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        <Button asChild variant="outline" className="w-full text-base py-8">
          <Link href="/admin/super/user-management">
            <UserCog className="mr-4 h-6 w-6" />
            Manage Users
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full text-base py-8">
          <Link href="/admin/super/verification">
            <CheckCheck className="mr-4 h-6 w-6" />
            Manage Verification
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full text-base py-8">
          <Link href="/admin/super/colorful-name">
            <Sparkles className="mr-4 h-6 w-6" />
            Manage Colorful Names
          </Link>
        </Button>
      </div>
    </div>
  );
}
