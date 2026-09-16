import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { status, priority, title, description, videoUrl, tags, imageUrls } = body;

    const data: any = { updatedAt: new Date() };
    if (status)      data.status      = status;
    if (priority)    data.priority    = priority;
    if (title)       data.title       = title;
    if (description) data.description = description;
    if (videoUrl !== undefined) data.videoUrl = videoUrl;
    if (tags)        data.tags        = JSON.stringify(tags);
    if (imageUrls)   data.imageUrls   = JSON.stringify(imageUrls);

    const ticket = await prisma.supportTicket.update({
      where: { id: params.id },
      data,
      include: { createdBy: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Chamados PATCH error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar chamado' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.supportTicket.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Chamados DELETE error:', error);
    return NextResponse.json({ error: 'Erro ao deletar chamado' }, { status: 500 });
  }
}
