import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { isAdminRole } from '@/lib/sellerCommission';

export const ADMIN_EMAILS = [
  'grupomercatta@gmail.com',
  'matheus@grupomercatta.com.br',
  'matheusconti@gmail.com',
  'matheus@grupomercatta.com',
  'admin@mercatta.com.br',
];

export { isAdminRole };

export async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (dbUser?.status === 'BLOCKED') return false;
  return isAdminRole(dbUser?.role);
}
