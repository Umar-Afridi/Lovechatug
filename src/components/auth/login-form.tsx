import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { GoogleIcon } from '@/components/icons/google-icon';
import Link from 'next/link';

export function LoginForm() {
  return (
    <Card className="w-full max-w-sm shadow-2xl shadow-primary/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-headline">Welcome to LoveChat</CardTitle>
        <CardDescription>
          Sign in to connect with your loved ones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/chat">
                <GoogleIcon className="mr-2 h-4 w-4" />
                Sign in with Google
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
