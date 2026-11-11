-- Add optional equipment attributes used by the printed 120 x 80 mm label.
-- Existing machine rows, photos, relationships, and RLS policies are preserved.
begin;

alter table public.equipment
  add column if not exists manufacturer text,
  add column if not exists model text,
  add column if not exists serial_number text,
  add column if not exists manufacturing_year integer,
  add column if not exists installation_date date,
  add column if not exists voltage text,
  add column if not exists current_rating text,
  add column if not exists power_rating text,
  add column if not exists frequency text,
  add column if not exists phase_count text,
  add column if not exists capacity text,
  add column if not exists working_pressure text,
  add column if not exists stroke text,
  add column if not exists dimensions text,
  add column if not exists weight text,
  add column if not exists lubricant text,
  add column if not exists lubricant_quantity text,
  add column if not exists lubrication_interval text,
  add column if not exists preventive_general_inspection text,
  add column if not exists preventive_electrical_check text,
  add column if not exists preventive_oil_change text,
  add column if not exists preventive_general_overhaul text;

comment on column public.equipment.manufacturer is 'Fabricante para identificação e etiqueta do equipamento.';
comment on column public.equipment.model is 'Modelo para identificação e etiqueta do equipamento.';
comment on column public.equipment.serial_number is 'Número de série para identificação e etiqueta do equipamento.';
comment on column public.equipment.manufacturing_year is 'Ano de fabricação do equipamento.';
comment on column public.equipment.installation_date is 'Data de instalação do equipamento.';
comment on column public.equipment.voltage is 'Tensão elétrica indicada na etiqueta do equipamento.';
comment on column public.equipment.current_rating is 'Corrente elétrica indicada na etiqueta do equipamento.';
comment on column public.equipment.power_rating is 'Potência indicada na etiqueta do equipamento.';
comment on column public.equipment.frequency is 'Frequência elétrica indicada na etiqueta do equipamento.';
comment on column public.equipment.phase_count is 'Número de fases indicado na etiqueta do equipamento.';
comment on column public.equipment.capacity is 'Capacidade operacional do equipamento.';
comment on column public.equipment.working_pressure is 'Pressão de trabalho do equipamento.';
comment on column public.equipment.stroke is 'Curso do equipamento.';
comment on column public.equipment.dimensions is 'Dimensões C × L × A do equipamento.';
comment on column public.equipment.weight is 'Peso do equipamento.';
comment on column public.equipment.lubricant is 'Óleo ou graxa especificado para o equipamento.';
comment on column public.equipment.lubricant_quantity is 'Volume ou quantidade de lubrificante.';
comment on column public.equipment.lubrication_interval is 'Periodicidade de troca ou lubrificação.';
comment on column public.equipment.preventive_general_inspection is 'Orientação ou periodicidade da inspeção geral.';
comment on column public.equipment.preventive_electrical_check is 'Orientação ou periodicidade da verificação elétrica.';
comment on column public.equipment.preventive_oil_change is 'Orientação ou periodicidade da troca de óleo.';
comment on column public.equipment.preventive_general_overhaul is 'Orientação ou periodicidade da revisão geral.';

notify pgrst, 'reload schema';
commit;
