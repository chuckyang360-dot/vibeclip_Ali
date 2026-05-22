import { useEffect, useMemo, useState } from 'react';
import { AdminAIModel, AdminAIStageConfig, adminApi } from '../../api/adminApi';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { AdminErrorState } from './AdminErrorState';
import { AdminLoadingState } from './AdminLoadingState';

type PromptDraft = {
  name: string;
  system_prompt: string;
  user_prompt_template: string;
};

type ModelForm = {
  provider: string;
  model_id: string;
  display_name: string;
  capability: string;
};

function compactModel(model: AdminAIModel | null): string {
  if (!model) return '-';
  return `${model.provider} / ${model.model_id}`;
}

function statusTone(status: string): string {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

function buildDraft(stage: AdminAIStageConfig): PromptDraft {
  const prompt = stage.active_prompt;
  return {
    name: prompt?.name || `${stage.stage_name} Prompt`,
    system_prompt: prompt?.system_prompt || '',
    user_prompt_template: prompt?.user_prompt_template || '',
  };
}

export function AdminAiModelConfigPanel() {
  const { locale } = useAdminLocale();
  const [items, setItems] = useState<AdminAIStageConfig[]>([]);
  const [models, setModels] = useState<AdminAIModel[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PromptDraft>>({});
  const [selectedModelIds, setSelectedModelIds] = useState<Record<string, string>>({});
  const [selectedPromptIds, setSelectedPromptIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm>({
    provider: 'gemini',
    model_id: '',
    display_name: '',
    capability: 'text',
  });

  const capabilityOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.capability) set.add(item.capability);
    });
    models.forEach((model) => {
      if (model.capability) set.add(model.capability);
    });
    return Array.from(set).sort();
  }, [items, models]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await adminApi.aiConfigs();
      setItems(res.items || []);
      setModels(res.models || []);
      const nextDrafts: Record<string, PromptDraft> = {};
      const nextModels: Record<string, string> = {};
      const nextPrompts: Record<string, string> = {};
      (res.items || []).forEach((item) => {
        nextDrafts[item.stage_key] = buildDraft(item);
        nextModels[item.stage_key] = item.active_model?.id ? String(item.active_model.id) : '';
        nextPrompts[item.stage_key] = item.active_prompt?.id ? String(item.active_prompt.id) : '';
      });
      setDrafts(nextDrafts);
      setSelectedModelIds(nextModels);
      setSelectedPromptIds(nextPrompts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveModel(stage: AdminAIStageConfig) {
    const rawId = selectedModelIds[stage.stage_key];
    const modelId = Number(rawId);
    if (!modelId) return;
    setSavingKey(`${stage.stage_key}:model`);
    setError(null);
    try {
      const res = await adminApi.updateAiStageModel(stage.stage_key, {
        model_catalog_id: modelId,
        reason: `admin ${stage.stage_key} model update`,
      });
      setItems((prev) => prev.map((item) => (item.stage_key === stage.stage_key ? res.config : item)));
      setNotice(locale === 'zh' ? '模型配置已保存' : 'Model saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function publishPrompt(stage: AdminAIStageConfig) {
    const draft = drafts[stage.stage_key];
    if (!draft?.system_prompt.trim()) return;
    setSavingKey(`${stage.stage_key}:prompt`);
    setError(null);
    try {
      const res = await adminApi.publishAiPrompt(stage.stage_key, {
        name: draft.name.trim() || `${stage.stage_name} Prompt`,
        system_prompt: draft.system_prompt,
        user_prompt_template: draft.user_prompt_template,
        variables_schema: stage.active_prompt?.variables_schema || {},
        reason: `admin ${stage.stage_key} prompt publish`,
      });
      setItems((prev) => prev.map((item) => (item.stage_key === stage.stage_key ? res.config : item)));
      setSelectedPromptIds((prev) => ({
        ...prev,
        [stage.stage_key]: res.config.active_prompt?.id ? String(res.config.active_prompt.id) : '',
      }));
      setNotice(locale === 'zh' ? 'Prompt 已发布' : 'Prompt published');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function activatePrompt(stage: AdminAIStageConfig) {
    const promptId = Number(selectedPromptIds[stage.stage_key]);
    if (!promptId) return;
    setSavingKey(`${stage.stage_key}:activate`);
    setError(null);
    try {
      const res = await adminApi.activateAiPrompt(stage.stage_key, {
        prompt_template_id: promptId,
        reason: `admin ${stage.stage_key} prompt activate`,
      });
      setItems((prev) => prev.map((item) => (item.stage_key === stage.stage_key ? res.config : item)));
      setDrafts((prev) => ({ ...prev, [stage.stage_key]: buildDraft(res.config) }));
      setNotice(locale === 'zh' ? 'Prompt 版本已启用' : 'Prompt activated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingKey(null);
    }
  }

  async function createModel() {
    if (!modelForm.provider.trim() || !modelForm.model_id.trim() || !modelForm.display_name.trim()) return;
    setSavingKey('model:create');
    setError(null);
    try {
      const res = await adminApi.createAiModel({
        provider: modelForm.provider,
        model_id: modelForm.model_id,
        display_name: modelForm.display_name,
        capability: modelForm.capability,
        enabled: true,
        sort_order: 100,
      });
      setModels((prev) => [...prev, res.model]);
      setShowModelForm(false);
      setModelForm({ provider: 'gemini', model_id: '', display_name: '', capability: 'text' });
      setNotice(locale === 'zh' ? '模型已添加' : 'Model added');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <AdminLoadingState />;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50">
            <i className="ri-robot-2-line text-sm text-cyan-700" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{locale === 'zh' ? 'AI 调用配置' : 'AI Call Config'}</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowModelForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <i className="ri-add-line text-sm" />
          {locale === 'zh' ? '添加模型' : 'Add Model'}
        </button>
      </div>

      {error ? <AdminErrorState message={error} /> : null}
      {notice ? <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div> : null}

      {showModelForm ? (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <input
              value={modelForm.provider}
              onChange={(e) => setModelForm((prev) => ({ ...prev, provider: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
              placeholder={locale === 'zh' ? '服务商' : 'Provider'}
            />
            <input
              value={modelForm.model_id}
              onChange={(e) => setModelForm((prev) => ({ ...prev, model_id: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 lg:col-span-2"
              placeholder="model_id"
            />
            <input
              value={modelForm.display_name}
              onChange={(e) => setModelForm((prev) => ({ ...prev, display_name: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
              placeholder={locale === 'zh' ? '显示名称' : 'Display name'}
            />
            <select
              value={modelForm.capability}
              onChange={(e) => setModelForm((prev) => ({ ...prev, capability: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
            >
              {(capabilityOptions.length ? capabilityOptions : ['text', 'vision_text', 'image', 'video']).map((cap) => (
                <option key={cap} value={cap}>
                  {cap}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void createModel()}
              disabled={savingKey === 'model:create'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <i className="ri-save-3-line text-sm" />
              {locale === 'zh' ? '保存' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((stage) => {
          const draft = drafts[stage.stage_key] || buildDraft(stage);
          return (
            <div key={stage.stage_key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{stage.stage_name}</h3>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {stage.capability}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{compactModel(stage.active_model)}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(stage.active_prompt?.status || '')}`}>
                  v{stage.active_prompt?.version || '-'} {stage.active_prompt?.status || '-'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,320px)_1fr]">
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-500">{locale === 'zh' ? '模型' : 'Model'}</span>
                    <select
                      value={selectedModelIds[stage.stage_key] || ''}
                      onChange={(e) => setSelectedModelIds((prev) => ({ ...prev, [stage.stage_key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
                    >
                      {stage.candidate_models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.provider} / {model.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveModel(stage)}
                    disabled={savingKey === `${stage.stage_key}:model`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <i className="ri-switch-line text-sm" />
                    {locale === 'zh' ? '保存模型' : 'Save Model'}
                  </button>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-500">{locale === 'zh' ? 'Prompt 版本' : 'Prompt Version'}</span>
                    <select
                      value={selectedPromptIds[stage.stage_key] || ''}
                      onChange={(e) => setSelectedPromptIds((prev) => ({ ...prev, [stage.stage_key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
                    >
                      {stage.prompt_versions.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          v{prompt.version} / {prompt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void activatePrompt(stage)}
                    disabled={savingKey === `${stage.stage_key}:activate`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <i className="ri-upload-cloud-2-line text-sm" />
                    {locale === 'zh' ? '启用版本' : 'Activate'}
                  </button>
                </div>

                <div className="space-y-3">
                  <input
                    value={draft.name}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [stage.stage_key]: { ...draft, name: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
                    placeholder={locale === 'zh' ? 'Prompt 名称' : 'Prompt name'}
                  />
                  <textarea
                    value={draft.system_prompt}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [stage.stage_key]: { ...draft, system_prompt: e.target.value } }))}
                    className="min-h-32 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-5 text-gray-800"
                    placeholder="system_prompt"
                  />
                  <textarea
                    value={draft.user_prompt_template}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [stage.stage_key]: { ...draft, user_prompt_template: e.target.value } }))}
                    className="min-h-20 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs leading-5 text-gray-800"
                    placeholder="user_prompt_template"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void publishPrompt(stage)}
                      disabled={savingKey === `${stage.stage_key}:prompt`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <i className="ri-send-plane-line text-sm" />
                      {locale === 'zh' ? '发布 Prompt' : 'Publish Prompt'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
