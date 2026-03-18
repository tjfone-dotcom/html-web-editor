# HTML Web Editor - 설계 문서

## Context

사용자가 HTML 파일을 업로드하면 브라우저처럼 렌더링된 화면에서 요소를 클릭하여 시각적으로 편집할 수 있는 웹 에디터를 만든다. 비개발자가 HTML 프레젠테이션이나 랜딩페이지의 텍스트, 색상, 스타일 등을 코드 수정 없이 직관적으로 변경하고, 수정본을 저장하거나 섹션별 이미지로 캡쳐할 수 있도록 하는 것이 목표다.

### 범위 제한
- **데스크톱 전용** (최소 너비 1024px)
- 요소의 드래그 이동/리사이즈는 지원하지 않음 (스타일 속성 편집만)
- `<video>`, `<svg>`, `<canvas>` 등 특수 요소는 선택 시 "편집 불가 요소" 안내 표시

---

## 1. 기술 스택

| 영역 | 기술 | 용도 |
|------|------|------|
| 프레임워크 | React 18 + TypeScript | 컴포넌트 기반 UI |
| 빌드 | Vite | 빠른 개발/빌드 |
| 상태 관리 | Zustand | 선택 요소, 편집 상태, Undo/Redo 히스토리 관리 |
| 에디터 UI | Tailwind CSS | 에디터 패널 스타일링 |
| 코드 편집 | Monaco Editor (@monaco-editor/react) | HTML 소스 직접 편집 |
| 캡쳐 | html2canvas | 섹션별 이미지 캡쳐 |
| 압축 | JSZip + FileSaver.js | 다중 이미지 ZIP 다운로드 |

---

## 2. 아키텍처: iframe 기반 격리

### 핵심 원칙
업로드된 HTML을 `<iframe>`에 렌더링하여 원본 CSS와 에디터 UI를 완전히 격리한다.

### iframe 렌더링 방식: Blob URL
- `srcdoc`는 대용량 HTML에서 브라우저별 크기 제한이 있으므로 **Blob URL** 사용
- `new Blob([htmlWithBridge], { type: 'text/html' })` → `URL.createObjectURL(blob)`
- iframe의 `sandbox` 속성: `allow-scripts allow-same-origin` (스크립트 실행 허용하되, 팝업/폼 제출 등 차단)

### 데이터 흐름
```
[파일 업로드] → htmlContent(state) → Blob URL → iframe
                                                  ↓
                                        bridge script 주입
                                                  ↓
                                     요소 클릭 → postMessage → EditorPanel
                                                                 ↓
                                                        속성 변경 UI 표시
                                                                 ↓
                                              postMessage → iframe DOM 업데이트
                                                                 ↓
                                                        [저장] → DOM serialize → .html 다운로드
```

### Bridge Script
iframe에 로드되는 HTML에 `<script data-bridge>` 태그로 삽입. 역할:
- 모든 요소에 `mouseover`(하이라이트) / `click`(선택) 이벤트 바인딩
- 선택된 요소에 `data-editor-id` 속성 부여 (고유 식별자, DOM 변경에도 안정적)
- 선택된 요소 정보를 postMessage로 부모 윈도우에 전달
- 부모로부터 받은 스타일 변경 명령을 DOM에 적용
- 텍스트 요소 더블클릭 시 contentEditable 활성화
- 기본 링크 이동, 폼 제출 등 차단 (편집 모드)
- `html2canvas` 라이브러리도 bridge와 함께 주입 (캡쳐 시 iframe 내부에서 실행)

---

## 3. 레이아웃

```
┌─────────────────────────────────────────────────┐
│  Header: 로고 | 파일명 | [되돌리기][다시] [HTML 저장] [캡쳐] │
├──────────────┬──────────────────────────────────┤
│  EditorPanel │  PreviewPanel                    │
│  (~300px)    │  (나머지 영역)                    │
│              │                                  │
│  ┌─────────┐│  ┌──────────────────────────────┐│
│  │파일 업로드││  │ [프리뷰] [코드] 뷰 토글       ││
│  └─────────┘│  │                              ││
│              │  │  iframe (16:9 비율 고정)      ││
│  ┌─────────┐│  │  또는                         ││
│  │요소 정보  ││  │  Monaco Editor (코드 모드)    ││
│  │태그/클래스││  │                              ││
│  └─────────┘│  │                              ││
│              │  └──────────────────────────────┘│
│  ┌─────────┐│                                  │
│  │속성 편집  ││                                  │
│  │(동적 UI) ││                                  │
│  │☐ 클래스  ││                                  │
│  │  전체적용 ││                                  │
│  └─────────┘│                                  │
│              │                                  │
│  ┌─────────┐│                                  │
│  │캡쳐 설정  ││                                  │
│  │포맷/해상도││                                  │
│  │섹션 미리기││                                  │
│  └─────────┘│                                  │
├──────────────┴──────────────────────────────────┤
│  StatusBar: 선택 요소 경로 (body > div > h1)     │
└─────────────────────────────────────────────────┘
```

### 초기 상태 (파일 업로드 전)
- PreviewPanel: "HTML 파일을 업로드하세요" 안내 + 드래그&드롭 영역
- EditorPanel: FileUploader만 표시, 속성/캡쳐 패널 숨김
- 요소 선택 전: 속성 패널에 "요소를 클릭하여 선택하세요" 안내

### 16:9 비율 유지 로직
- PreviewPanel 영역 내에서 가용 너비를 기준으로 `height = width * 9/16` 계산
- `ResizeObserver`로 브라우저 리사이즈 감지 → 비율 재계산
- CSS `aspect-ratio: 16/9` + `max-height` + `max-width`로 영역 내 최대 크기 유지
- iframe은 이 컨테이너 안에서 `width: 100%; height: 100%`

---

## 4. 요소 선택 시스템

### 선택 흐름
1. iframe 내 요소에 마우스 오버 → 반투명 파란색 outline 표시 (hover highlight)
2. 클릭 → 해당 요소 선택 (실선 outline으로 변경)
3. bridge script가 요소에 `data-editor-id` 부여 → 부모에 요소 정보 전달:
   - `editorId` (data-editor-id 값, DOM 변경에도 안정적인 식별자)
   - `tagName`, `className`, `id`
   - `computedStyles` (주요 CSS 속성들)
   - `textContent` (텍스트 요소인 경우)
   - `elementType` (분류된 요소 타입)
4. 더블클릭 → 텍스트 요소의 경우 인라인 편집 모드 진입 (contentEditable)

### 요소 타입 분류 로직
```typescript
function classifyElement(el: HTMLElement): ElementType {
  const tag = el.tagName.toLowerCase();

  // 버튼을 먼저 판별 (a.btn이 text로 분류되는 것 방지)
  if (tag === 'button' || el.classList.contains('btn') || el.getAttribute('role') === 'button')
    return 'button';
  if (['h1','h2','h3','h4','h5','h6','p','span','a','label','li'].includes(tag))
    return 'text';
  if (tag === 'img')
    return 'image';
  if (tag === 'hr')
    return 'line';
  if (['video','svg','canvas','iframe'].includes(tag))
    return 'unsupported'; // 편집 불가 안내
  // div, section 등 컨테이너
  return 'box';
}
```

---

## 5. 동적 속성 편집 패널

선택된 요소의 타입에 따라 왼쪽 패널의 속성 편집 UI가 동적으로 변경된다.

### 타입별 편집 속성

**텍스트** (h1~h6, p, span, a, label, li):
| 속성 | UI 컴포넌트 |
|------|-----------|
| 텍스트 내용 | 텍스트 입력란 (인라인 편집과 동기화) |
| font-size | 슬라이더 + 숫자 입력 (px) |
| font-family | 드롭다운 (시스템 폰트 + 웹 안전 폰트) |
| font-weight | 드롭다운 (100~900) |
| font-style | 토글 (normal / italic) |
| color | 컬러 피커 |
| text-align | 버튼 그룹 (left / center / right / justify) |
| line-height | 슬라이더 |
| letter-spacing | 슬라이더 |

**버튼** (button, .btn 클래스):
| 속성 | UI 컴포넌트 |
|------|-----------|
| 텍스트 내용 | 텍스트 입력란 |
| background-color | 컬러 피커 |
| color (글자색) | 컬러 피커 |
| border-radius | 슬라이더 |
| border | 두께 + 색상 + 스타일 |
| padding | 상하좌우 슬라이더 |
| font-size | 슬라이더 |

**박스/컨테이너** (div, section):
| 속성 | UI 컴포넌트 |
|------|-----------|
| background-color | 컬러 피커 |
| background-image | URL 입력 또는 파일 선택 |
| border | 두께 + 색상 + 스타일 |
| border-radius | 슬라이더 |
| padding | 상하좌우 슬라이더 |
| margin | 상하좌우 슬라이더 |
| box-shadow | X/Y/Blur/Spread 슬라이더 + 색상 |

**이미지** (img):
| 속성 | UI 컴포넌트 |
|------|-----------|
| src | 파일 선택 (base64로 변환) |
| width / height | 슬라이더 + 비율 잠금 토글 |
| border-radius | 슬라이더 |
| opacity | 슬라이더 (0~1) |
| object-fit | 드롭다운 (cover / contain / fill / none) |

**선/구분선** (hr):
| 속성 | UI 컴포넌트 |
|------|-----------|
| border-color | 컬러 피커 |
| border-width | 슬라이더 |
| border-style | 드롭다운 (solid / dashed / dotted) |
| width | 슬라이더 (%) |

**편집 불가** (video, svg, canvas, iframe):
- "이 요소 타입은 편집할 수 없습니다" 안내 메시지 표시

### 클래스 전체 적용
- 속성 패널 상단에 "같은 클래스에 모두 적용" 체크박스
- 다중 클래스인 경우 드롭다운으로 적용할 클래스 선택 (예: `btn btn-primary mt-4` → 사용자가 선택)
- **미체크(기본)**: 해당 요소의 `inline style`만 수정
- **체크**: `<style>` 태그에 해당 클래스의 CSS rule을 추가/수정하여 같은 클래스의 모든 요소에 적용

### 속성 일괄 업데이트
- `updateElementStyles(styles: Record<string, string>)` 액션으로 여러 속성을 한번에 업데이트
- padding/margin 등 4방향 속성 변경 시 postMessage 왕복 횟수 최소화

---

## 6. Undo/Redo 시스템

### 히스토리 스택
```typescript
interface HistoryEntry {
  htmlContent: string;  // 변경 시점의 전체 HTML 스냅샷
  label: string;        // 변경 설명 (예: "font-size 변경", "텍스트 편집")
}
```

- Zustand store에 `history: HistoryEntry[]`, `historyIndex: number` 관리
- 최대 50단계 히스토리 유지 (메모리 제한)
- 모든 속성 변경, 텍스트 편집, 코드 편집 완료 시 히스토리에 추가
- 프리뷰 모드 변경과 코드 모드 변경 모두 동일한 히스토리 스택 사용

### 단축키
- `Ctrl+Z`: Undo
- `Ctrl+Shift+Z` / `Ctrl+Y`: Redo
- `Ctrl+S`: HTML 저장/다운로드

### 원본 복원
- "원본으로 되돌리기" 버튼: 업로드 시점의 HTML로 전체 복원
- `originalHtmlContent`를 별도로 보관

---

## 7. 뷰 모드

### 프리뷰 모드 (기본)
- iframe으로 HTML 렌더링
- 요소 선택, 인라인 편집 활성화
- bridge script 동작

### 코드 모드
- Monaco Editor로 HTML 소스 코드 표시
- **편집 가능**: 코드 수정 시 프리뷰에 실시간 반영 (debounce 500ms)
- 코드 → 프리뷰 동기화: 코드 변경 → htmlContent state 업데이트 → iframe 재렌더링
- 프리뷰 → 코드 동기화: DOM 변경 → serialize → htmlContent 업데이트 → Monaco 내용 갱신
- **무한 루프 방지**: `isSyncingRef` 플래그로 프로그래밍 방식의 Monaco 내용 설정 시 onChange 콜백 억제
- Syntax highlighting, 자동 완성 기본 제공

---

## 8. 입력 유효성 검증

### 파일 업로드 검증
- **허용 확장자**: `.html`, `.htm`
- **최대 파일 크기**: 10MB (초과 시 "파일이 너무 큽니다" 안내)
- **기본 유효성**: 파일 내용에 `<` 문자가 포함되어 있는지 확인 (바이너리 파일 방지)

### 외부 리소스 처리
- 외부 CSS/JS/이미지(CDN 등)는 그대로 로드 시도 (Blob URL에서도 절대 경로는 동작)
- 상대 경로 리소스는 로드 실패 → 깨진 이미지 등은 사용자에게 시각적으로 표시됨
- 캡쳐 시 `useCORS: true` 설정으로 가능한 범위 내에서 외부 이미지 포함

---

## 9. 멀티 스크린 캡쳐

### 섹션 자동 감지

**1단계: HTML 유형 판별**
```
슬라이드 덱 판별 조건 (하나라도 충족 시):
- reveal.js 구조: section > section 중첩 패턴
- [data-slide], .slide, .page 클래스 존재
- 각 직계 자식이 100vh height를 가짐
- swiper, impress.js 등 알려진 슬라이드 프레임워크 패턴

→ 불충족 시 스크롤형 페이지로 간주
```

**2단계: 섹션 분할**

슬라이드 덱:
- 각 슬라이드 요소를 독립 섹션으로 처리
- 16:9 고정 비율로 캡쳐

스크롤형 페이지:
- `<section>` 태그 경계로 1차 분할
- section 태그가 없으면: 배경색/배경이미지 변화 지점 감지
  - body 직계 자식 요소들의 computed `background-color` 비교
  - 색상 차이 임계값: RGB 각 채널 차이 합 > 30 (미세한 차이는 같은 섹션으로 간주)
  - `transparent`/`rgba(0,0,0,0)`는 부모 배경을 상속한 것으로 처리
- 위 방법으로 감지 실패 시 (단일 섹션만 감지): `id` 속성이 있는 블록 요소를 경계로 분할
- 최종 폴백: 전체 페이지를 하나의 이미지로 캡쳐
- **캡쳐 비율**: 너비는 뷰포트 기준 고정, 높이는 각 섹션의 실제 콘텐츠 높이에 맞춤 (섹션마다 비율이 다를 수 있음)

### 캡쳐 프로세스
1. "멀티 캡쳐" 버튼 클릭
2. 섹션 자동 감지 → 감지된 섹션 목록 미리보기 (섹션 번호, 높이, 미리보기 썸네일)
3. 출력 설정:
   - 포맷: JPG / PNG (기본: JPG)
   - 해상도: 1x / 2x / 3x (기본: 2x)
4. "캡쳐 시작" 클릭
5. html2canvas로 각 섹션 순차 캡쳐 (진행률 표시)
6. JSZip으로 묶어 `{파일명}_captures.zip`으로 다운로드
   - 파일명 패턴: `section-01.jpg`, `section-02.jpg`, ...

### html2canvas 캡쳐 구현
- bridge script와 함께 html2canvas를 iframe 내부에 주입 (cross-origin 이슈 방지)
- 각 섹션 요소를 대상으로 `html2canvas(sectionEl, { scale, useCORS: true })`
- 캡쳐 완료된 canvas를 `toBlob()` → postMessage(transferable)로 부모에 전달 → ZIP에 추가
- **알려진 제한**: CSS Grid 일부, `backdrop-filter`, `clip-path`, 복잡한 SVG 필터 등은 정확히 렌더링되지 않을 수 있음

---

## 10. HTML 저장

### 저장 프로세스
1. iframe 내 DOM을 `document.documentElement.outerHTML`로 serialize
2. bridge script (`<script data-bridge>`) 제거
3. `data-editor-id` 속성 제거
4. 주입된 하이라이트 스타일, 선택 표시 등 제거
5. 원본 DOCTYPE 복원
6. Blob 생성 → `<a download="{파일명}">` 클릭으로 다운로드

---

## 11. 컴포넌트 구조

```
src/
├── App.tsx                     # 최상위 레이아웃
├── main.tsx                    # 엔트리포인트
├── store/
│   └── editorStore.ts          # Zustand store (편집 상태 + Undo/Redo 히스토리)
├── components/
│   ├── Header.tsx              # 상단 바 (로고, 파일명, Undo/Redo, 액션 버튼)
│   ├── StatusBar.tsx           # 하단 상태 바
│   ├── editor/                 # 왼쪽 에디터 패널
│   │   ├── EditorPanel.tsx     # 에디터 패널 컨테이너
│   │   ├── FileUploader.tsx    # 파일 업로드 (드래그&드롭)
│   │   ├── ElementInfo.tsx     # 선택된 요소 정보 표시
│   │   ├── PropertyEditor.tsx  # 동적 속성 편집 라우터
│   │   ├── properties/
│   │   │   ├── TextProperties.tsx
│   │   │   ├── ButtonProperties.tsx
│   │   │   ├── BoxProperties.tsx
│   │   │   ├── ImageProperties.tsx
│   │   │   └── LineProperties.tsx
│   │   ├── controls/           # 재사용 가능한 편집 컨트롤
│   │   │   ├── ColorPicker.tsx
│   │   │   ├── Slider.tsx
│   │   │   ├── FontSelector.tsx
│   │   │   └── SpacingControl.tsx
│   │   └── CapturePanel.tsx    # 캡쳐 설정 및 실행
│   └── preview/                # 오른쪽 프리뷰 패널
│       ├── PreviewPanel.tsx    # 프리뷰 패널 컨테이너
│       ├── HtmlPreview.tsx     # iframe 프리뷰
│       ├── CodeEditor.tsx      # Monaco 코드 편집기
│       └── ViewToggle.tsx      # 프리뷰/코드 전환
├── bridge/
│   └── bridge.ts               # iframe에 주입할 bridge script
├── utils/
│   ├── elementClassifier.ts    # 요소 타입 분류
│   ├── sectionDetector.ts      # 섹션 자동 감지
│   ├── htmlSerializer.ts       # DOM → HTML 변환 (bridge/editor 흔적 제거)
│   └── captureEngine.ts        # html2canvas 캡쳐 로직
└── types/
    └── editor.ts               # TypeScript 타입 정의
```

### 주요 상태 (Zustand)
```typescript
interface EditorState {
  // 파일
  htmlContent: string;
  originalHtmlContent: string;  // 업로드 원본 (복원용)
  fileName: string;

  // 선택
  selectedElement: {
    editorId: string;       // data-editor-id (DOM 변경에 안정적)
    tagName: string;
    className: string;
    id: string;
    elementType: 'text' | 'button' | 'box' | 'image' | 'line' | 'unsupported';
    computedStyles: Record<string, string>;
    textContent?: string;
  } | null;

  // 편집
  viewMode: 'preview' | 'code';
  isClassApply: boolean;
  selectedClass: string | null;  // 다중 클래스 시 선택된 클래스

  // Undo/Redo
  history: { htmlContent: string; label: string }[];
  historyIndex: number;

  // 액션
  setHtmlContent: (content: string, label?: string) => void;
  setSelectedElement: (el: SelectedElement | null) => void;
  updateElementStyles: (styles: Record<string, string>) => void;  // 일괄 업데이트
  toggleViewMode: () => void;
  toggleClassApply: () => void;
  undo: () => void;
  redo: () => void;
  resetToOriginal: () => void;
}
```

---

## 12. 검증 방법

### 기능 테스트
1. **파일 업로드**: 다양한 HTML 파일 (슬라이드 덱, 랜딩페이지) 업로드 → iframe에 정상 렌더링 확인
2. **유효성 검증**: 비HTML 파일, 10MB 초과 파일 업로드 → 적절한 오류 메시지 확인
3. **요소 선택**: 텍스트, 버튼, 이미지 등 클릭 → 왼쪽 패널에 해당 타입의 속성 UI 표시 확인
4. **a.btn 분류**: `<a class="btn">` 요소 클릭 → 버튼 타입으로 분류되는지 확인
5. **인라인 편집**: 텍스트 더블클릭 → 직접 수정 → 변경 반영 확인
6. **속성 편집**: 색상, 크기 등 변경 → iframe 내 실시간 반영 확인
7. **클래스 전체 적용**: 토글 on → 같은 클래스의 다른 요소들도 변경 확인
8. **Undo/Redo**: 속성 변경 후 Ctrl+Z → 복원 확인, Ctrl+Shift+Z → 재적용 확인
9. **코드 모드**: 코드 편집 → 프리뷰 동기화, 프리뷰 편집 → 코드 동기화 확인 (무한 루프 없음)
10. **HTML 저장**: 수정된 HTML 다운로드 → 브라우저에서 열어 bridge 흔적 없이 변경 사항 유지 확인
11. **멀티 캡쳐**: 섹션 감지 → 미리보기 확인 → 캡쳐 → ZIP 다운로드 → 이미지 품질 확인
12. **16:9 비율**: 브라우저 리사이즈 → iframe 비율 유지 확인
13. **원본 복원**: "원본으로 되돌리기" → 최초 업로드 상태로 복원 확인

### 브라우저 호환
- Chrome, Edge, Firefox 최신 버전에서 동작 확인
