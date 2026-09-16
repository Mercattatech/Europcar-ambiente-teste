import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false, session: null };
  const isHardcoded = ADMIN_EMAILS.includes(session.user.email);
  if (isHardcoded) return { ok: true, session };
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return { ok: dbUser?.role === 'ADMIN', session };
}

export async function GET(request: Request) {
  const { ok } = await checkAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: any = {};
    if (status)   where.status   = status;
    if (priority) where.priority = priority;

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Chamados GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar chamados' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { ok, session } = await checkAdmin();
  if (!ok || !session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { title, description, priority, tags, imageUrls, videoUrl } = await request.json();

    if (!title || !description) {
      return NextResponse.json({ error: 'Título e descrição são obrigatórios' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const ticket = await prisma.supportTicket.create({
      data: {
        title,
        description,
        priority:   priority || 'NORMAL',
        tags:       JSON.stringify(tags || []),
        imageUrls:  JSON.stringify(imageUrls || []),
        videoUrl:   videoUrl || null,
        createdById: user.id,
      },
      include: { createdBy: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Chamados POST error:', error);
    return NextResponse.json({ error: 'Erro ao criar chamado' }, { status: 500 });
  }
}
