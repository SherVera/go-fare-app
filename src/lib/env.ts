import Constants from 'expo-constants';

type AppExtra = {
  eas?: { projectId?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;

export const easProjectId: string | undefined = extra.eas?.projectId;
