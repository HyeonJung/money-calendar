create extension if not exists pgcrypto;

create table if not exists public.ipos (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  company_name text not null,
  market text not null,
  sector text not null default '',
  offering_type text not null default '신규상장',
  status text not null check (status in ('active', 'upcoming', 'listed')),
  subscription_start date not null,
  subscription_end date not null,
  refund_date date not null,
  listing_date date not null,
  confirmed_offer_price integer,
  offer_price_range_low integer,
  offer_price_range_high integer,
  total_shares bigint,
  public_offering_shares bigint,
  underwriters text[] not null default '{}',
  lead_manager text not null default '',
  competition_rate numeric(10, 2),
  lockup_rate numeric(5, 2),
  institutional_commitment_rate numeric(5, 2),
  expected_market_cap bigint,
  description text not null default '',
  highlights text[] not null default '{}',
  risks text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ipos_slug_unique unique (slug),
  constraint ipos_date_order_check check (subscription_end >= subscription_start)
);

create index if not exists ipos_status_idx on public.ipos (status);
create index if not exists ipos_subscription_start_idx on public.ipos (subscription_start);
create index if not exists ipos_listing_date_idx on public.ipos (listing_date desc);
create index if not exists ipos_market_status_idx on public.ipos (market, status);

alter table public.ipos enable row level security;

drop policy if exists "Public read access to ipos" on public.ipos;
create policy "Public read access to ipos"
on public.ipos
for select
to anon, authenticated
using (true);

comment on table public.ipos is '한국 공모주 일정 앱용 샘플/운영 공모주 데이터 테이블';
comment on column public.ipos.description is '설명 텍스트. 샘플 데이터인 경우 예시 문구를 포함할 수 있음';

-- Sample seed rows for local/dev preview only.
insert into public.ipos (
  slug,
  company_name,
  market,
  sector,
  offering_type,
  status,
  subscription_start,
  subscription_end,
  refund_date,
  listing_date,
  confirmed_offer_price,
  offer_price_range_low,
  offer_price_range_high,
  total_shares,
  public_offering_shares,
  underwriters,
  lead_manager,
  competition_rate,
  lockup_rate,
  institutional_commitment_rate,
  expected_market_cap,
  description,
  highlights,
  risks
) values
  (
    'hangang-bio-therapeutics',
    '한강바이오테라퓨틱스',
    'KOSDAQ',
    '바이오',
    '신규상장',
    'active',
    date '2026-04-24',
    date '2026-04-25',
    date '2026-04-29',
    date '2026-05-04',
    26500,
    22000,
    26000,
    12800000,
    2200000,
    array['미래에셋증권', '한국투자증권'],
    '미래에셋증권',
    812.40,
    18.70,
    61.30,
    339200000000,
    '데모 화면 구성을 위한 샘플 공모주 예시 데이터입니다. 실제 투자 판단 근거로 사용할 수 없습니다.',
    array['기술특례 상장 콘셉트의 샘플 기업', '기관 수요예측 호조 시나리오 반영', '진행 중 청약 예시 일정'],
    array['임상 일정 지연 가능성', '실적 가시성보다 기술 기대감 비중이 큼', '업종 변동성 확대 시 수급 약화 가능']
  ),
  (
    'daehan-fintech-platform',
    '대한핀테크플랫폼',
    'KOSDAQ',
    '핀테크',
    '신규상장',
    'active',
    date '2026-04-23',
    date '2026-04-24',
    date '2026-04-28',
    date '2026-05-06',
    18000,
    15000,
    18000,
    9800000,
    1700000,
    array['KB증권', '신한투자증권'],
    'KB증권',
    536.20,
    12.10,
    44.80,
    176400000000,
    '실제 공모주 일정이 아닌 데모용 샘플 데이터입니다.',
    array['반복 매출형 핀테크 SaaS 예시', '복수 주관사 케이스', '진행 중 청약 상태 테스트 가능'],
    array['대형 고객 의존도 상승 가능성', '규제 변경에 따른 수수료 구조 변동 위험', '상장 직후 유통 물량 확대 가능']
  ),
  (
    'seoul-ai-robotics',
    '서울AI로보틱스',
    'KOSDAQ',
    '로봇·자동화',
    '신규상장',
    'upcoming',
    date '2026-04-28',
    date '2026-04-29',
    date '2026-05-04',
    date '2026-05-08',
    null,
    28000,
    32000,
    11000000,
    2000000,
    array['NH투자증권'],
    'NH투자증권',
    null,
    null,
    null,
    352000000000,
    '서비스 UI와 정렬 검증을 위한 청약 예정 샘플 레코드입니다.',
    array['청약 임박 상태 샘플', '희망 공모가 밴드만 공개된 상태', '단일 대표주관사 케이스'],
    array['수요예측 결과에 따라 공모가 하단 확정 가능성', '설비투자 경기 둔화 위험', '해외 확장 속도 불확실성']
  ),
  (
    'eastwave-content-tech',
    '이스트웨이브콘텐츠테크',
    'KOSDAQ',
    '미디어테크',
    '신규상장',
    'upcoming',
    date '2026-04-30',
    date '2026-05-01',
    date '2026-05-07',
    date '2026-05-12',
    null,
    13500,
    16500,
    8700000,
    1500000,
    array['삼성증권', '하나증권'],
    '삼성증권',
    null,
    null,
    null,
    143550000000,
    '운영 데이터가 아닌 예시용 공모주 레코드입니다.',
    array['청약 예정 상태와 다중 인수단 테스트 가능', '콘텐츠 SaaS 섹터 샘플', '상세 리스크 배열 검증 가능'],
    array['광고 경기 둔화 시 고객 예산 축소 가능', 'AI 생성 콘텐츠 규제 강화 가능성', '적자 지속 시 밸류에이션 부담 확대 가능']
  ),
  (
    'blueorbit-logistics',
    '블루오빗로지스틱스',
    'KOSPI',
    '물류',
    '신규상장',
    'upcoming',
    date '2026-05-06',
    date '2026-05-07',
    date '2026-05-11',
    date '2026-05-15',
    null,
    21000,
    25000,
    15600000,
    2600000,
    array['한국투자증권', '대신증권'],
    '한국투자증권',
    null,
    null,
    null,
    390000000000,
    '도심 물류 자동화 설비 기업이라는 설정의 샘플 일정입니다.',
    array['KOSPI 상장 사례 UI를 위한 샘플', '상대적으로 큰 공모 구조 예시', '다음 달 초 일정 카드 검증용'],
    array['대형 설비 수주 지연 시 실적 변동 가능', '원가 상승분 전가 제한 가능성', '재무구조 개선 효과 제한 가능']
  ),
  (
    'mirae-mobility-parts',
    '미래모빌리티부품',
    'KOSDAQ',
    '전장부품',
    '신규상장',
    'listed',
    date '2026-04-13',
    date '2026-04-14',
    date '2026-04-16',
    date '2026-04-22',
    14500,
    12000,
    14500,
    9400000,
    1600000,
    array['키움증권'],
    '키움증권',
    421.80,
    9.50,
    37.40,
    136300000000,
    '상장 후 상태를 점검하기 위한 최근 상장 샘플 레코드입니다.',
    array['최근 상장 섹션 구성용 샘플', '확정 공모가와 경쟁률 포함', '단일 주관사 케이스'],
    array['자동차 업황 둔화 시 고객 발주 감소 가능', '공급망 재편 영향 가능성', '보호예수 비중이 낮아 변동성 확대 가능']
  ),
  (
    'greengrid-energy-solution',
    '그린그리드에너지솔루션',
    'KOSDAQ',
    '친환경에너지',
    '신규상장',
    'listed',
    date '2026-04-07',
    date '2026-04-08',
    date '2026-04-10',
    date '2026-04-18',
    23000,
    19000,
    23000,
    10200000,
    1800000,
    array['신한투자증권', '유진투자증권'],
    '신한투자증권',
    698.10,
    15.20,
    58.90,
    234600000000,
    '실제 공시가 아닌 예시용 최근 상장 데이터입니다.',
    array['기관 의무보유 확약 수치가 있는 예시', '친환경 섹터 샘플 데이터', '상장 완료 후 카드 검증 가능'],
    array['정책 지원 축소 시 프로젝트 지연 가능', '수주 인식 시점 차이로 실적 변동 가능', '상장 직후 거래량 집중 가능']
  ),
  (
    'oneday-medical-device',
    '원데이메디컬디바이스',
    'KOSDAQ',
    '의료기기',
    '신규상장',
    'listed',
    date '2026-03-30',
    date '2026-03-31',
    date '2026-04-02',
    date '2026-04-10',
    9800,
    8500,
    9800,
    7600000,
    1400000,
    array['대신증권'],
    '대신증권',
    287.60,
    6.80,
    24.30,
    74480000000,
    '목록 정렬과 상세 리스크 표현을 위한 샘플 최근 상장 건입니다.',
    array['소형 딜 규모 샘플', '비교적 이른 최근 상장 일정', '보수적인 수요예측 결과 표현 가능'],
    array['제품 단가 인하 압력 가능성', '해외 인증 일정 지연 가능성', '기관 수요예측 흥행 강도 상대적 약세']
  )
on conflict (slug) do update
set
  company_name = excluded.company_name,
  market = excluded.market,
  sector = excluded.sector,
  offering_type = excluded.offering_type,
  status = excluded.status,
  subscription_start = excluded.subscription_start,
  subscription_end = excluded.subscription_end,
  refund_date = excluded.refund_date,
  listing_date = excluded.listing_date,
  confirmed_offer_price = excluded.confirmed_offer_price,
  offer_price_range_low = excluded.offer_price_range_low,
  offer_price_range_high = excluded.offer_price_range_high,
  total_shares = excluded.total_shares,
  public_offering_shares = excluded.public_offering_shares,
  underwriters = excluded.underwriters,
  lead_manager = excluded.lead_manager,
  competition_rate = excluded.competition_rate,
  lockup_rate = excluded.lockup_rate,
  institutional_commitment_rate = excluded.institutional_commitment_rate,
  expected_market_cap = excluded.expected_market_cap,
  description = excluded.description,
  highlights = excluded.highlights,
  risks = excluded.risks,
  updated_at = now();

create table if not exists public.ipo_documents (
  id uuid primary key default gen_random_uuid(),
  ipo_slug text not null references public.ipos (slug) on delete cascade,
  source text not null,
  rcept_no text not null,
  title text not null,
  url text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ipo_documents_source_rcept_no_unique unique (source, rcept_no)
);

create index if not exists ipo_documents_ipo_slug_idx on public.ipo_documents (ipo_slug);
create index if not exists ipo_documents_source_idx on public.ipo_documents (source);
create index if not exists ipo_documents_fetched_at_idx on public.ipo_documents (fetched_at desc);

alter table public.ipo_documents enable row level security;

drop policy if exists "Public read access to ipo_documents" on public.ipo_documents;
create policy "Public read access to ipo_documents"
on public.ipo_documents
for select
to anon, authenticated
using (true);

comment on table public.ipo_documents is 'DART 등 원문 근거 추적용 문서 메타데이터 저장 테이블. 쓰기는 service role 전제';
comment on column public.ipo_documents.rcept_no is 'DART 접수번호 등 외부 원문 추적 식별자';
comment on column public.ipo_documents.fetched_at is '외부 원문 메타데이터를 마지막으로 수집한 시각';

create table if not exists public.ipo_analysis (
  id uuid primary key default gen_random_uuid(),
  ipo_slug text not null references public.ipos (slug) on delete cascade,
  company_summary text not null default '',
  business_model text not null default '',
  investment_points text[] not null default '{}',
  risk_points text[] not null default '{}',
  source_notes text[] not null default '{}',
  source_confidence numeric(4, 3) not null default 0.500 check (source_confidence >= 0 and source_confidence <= 1),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ipo_analysis_ipo_slug_unique unique (ipo_slug)
);

create index if not exists ipo_analysis_generated_at_idx on public.ipo_analysis (generated_at desc);
create index if not exists ipo_analysis_source_confidence_idx on public.ipo_analysis (source_confidence desc);

alter table public.ipo_analysis enable row level security;

drop policy if exists "Public read access to ipo_analysis" on public.ipo_analysis;
create policy "Public read access to ipo_analysis"
on public.ipo_analysis
for select
to anon, authenticated
using (true);

comment on table public.ipo_analysis is '공모주 회사정보/투자포인트 요약 저장 테이블. 쓰기는 service role 전제';
comment on column public.ipo_analysis.source_notes is '요약 생성 시 참고한 근거 요약 또는 문서 메모 목록';
comment on column public.ipo_analysis.source_confidence is '근거 충실도 기반 내부 신뢰도 점수(0~1)';
comment on column public.ipos.description is '상세 화면용 짧은 요약 문구. DART 근거 기반 분석 원문 저장소는 ipo_analysis를 사용';
comment on column public.ipos.highlights is '화면 카드/상세용 투자 포인트 요약 배열. 근거 추적 데이터는 ipo_analysis/ipo_documents를 사용';
comment on column public.ipos.risks is '화면 카드/상세용 리스크 요약 배열. 근거 추적 데이터는 ipo_analysis/ipo_documents를 사용';

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'cron',
  status text not null check (status in ('success', 'failed', 'unauthorized')),
  dry_run boolean not null default false,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  message text not null default '',
  error_code text,
  counts jsonb,
  warnings text[] not null default '{}',
  errors text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists sync_runs_started_at_idx on public.sync_runs (started_at desc);
create index if not exists sync_runs_status_idx on public.sync_runs (status);
create index if not exists sync_runs_source_idx on public.sync_runs (source);

alter table public.sync_runs enable row level security;

comment on table public.sync_runs is '공모주 데이터 동기화 실행 이력. 쓰기와 조회는 service role 등 운영 권한 전제';
comment on column public.sync_runs.counts is '동기화 중 수집/정규화/저장된 건수 요약';
