import { PRODUCTION_LABEL } from "@/src/features/prompts/constants";
import {
  LangfuseNotFoundError,
  ValidationError,
  type Prompt,
} from "@langfuse/shared";
import { prisma } from "@langfuse/shared/src/db";

type GetPromptByNameParams = {
  promptName: string;
  projectId: string;
  version?: number | null;
  label?: string;
};

export const getPromptByName = async (
  params: GetPromptByNameParams,
): Promise<Prompt | null> => {
  const { promptName, projectId, version, label } = params;

  if (version && label)
    throw new ValidationError("Cannot specify both version and label");

  if (version) return getPromptByVersion({ projectId, promptName, version });

  if (label) return getPromptByLabel({ projectId, promptName, label });

  return getProductionPrompt(params);
};

export const getPrompts = async (
  project_id: string,
  name: string,
): Promise<Prompt | null> => {
  return (await prisma.prompt.findMany({
    where: {
      projectId: project_id,
      name,
    },
    orderBy: [{ createdAt: "desc" }],
  })) as any;
};

const getProductionPrompt = async ({
  promptName,
  projectId,
}: {
  promptName: string;
  projectId: string;
}): Promise<Prompt> => {
  const productionPrompt = await prisma.prompt.findFirst({
    where: {
      projectId: projectId,
      name: promptName,
      labels: {
        has: PRODUCTION_LABEL,
      },
    },
  });

  if (!productionPrompt)
    throw new LangfuseNotFoundError(
      `No production-labeled prompt found with name '${promptName}' in project ${projectId}`,
    );

  return productionPrompt;
};

const getPromptByVersion = async ({
  promptName,
  projectId,
  version,
}: {
  promptName: string;
  projectId: string;
  version: number;
}): Promise<Prompt> => {
  const prompt = await prisma.prompt.findFirst({
    where: {
      projectId: projectId,
      name: promptName,
      version: version,
    },
  });

  if (!prompt)
    throw new LangfuseNotFoundError(
      `No prompt found with name '${promptName}' in project ${projectId} with version ${version}`,
    );

  return prompt;
};

const getPromptByLabel = async ({
  promptName,
  projectId,
  label,
}: {
  promptName: string;
  projectId: string;
  label: string;
}): Promise<Prompt> => {
  const prompt = await prisma.prompt.findFirst({
    where: {
      projectId: projectId,
      name: promptName,
      labels: {
        has: label,
      },
    },
  });

  if (!prompt)
    throw new LangfuseNotFoundError(
      `No prompt found with name '${promptName}' in project ${projectId} with label ${label}`,
    );

  return prompt;
};

export const activatePrompt = async (id: string): Promise<Prompt> => {
  const prompt = await prisma.prompt.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!prompt) throw new LangfuseNotFoundError(`No prompt found with id ${id}`);

  await prisma.prompt.updateMany({
    where: { name: prompt.name },
    data: { isActive: false },
  });

  const activatedPrompt = await prisma.prompt.update({
    where: { id },
    data: { isActive: true },
  });

  return activatedPrompt;
};
