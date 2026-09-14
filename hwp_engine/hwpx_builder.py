# -*- coding: utf-8 -*-
"""
hwpx_builder.py — 교육청 실제 문서 기반 fragment library hwpx 생성기

원리:
  - 실제 충청북도교육청 고교학점제 현장지원단 운영 계획 hwpx에서
    대제목/소제목/불릿/표 서식 fragment를 추출해 사용
  - 동일한 header.xml(스타일/폰트)로 새 section0.xml 조립
  - 마크다운 태그 → fragment 매핑으로 교육청 수준 서식 자동 생성

마크다운 포맷:
  제목: 문서 제목
  부제목: 부제목 (선택)
  부서: 부서명 (선택)
  대제목: 관련 근거
  ◦ 항목1
  ◦ 항목2
  소제목: 세부 추진 계획
    - 세부 내용
  표:
  헤더1 | 헤더2 | 헤더3
  값1 | 값2 | 값3
"""

import os, re, random, zipfile, shutil, html, tempfile, struct

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template_master.hwpx')

# ─── XML 섹션 헤더/푸터 ──────────────────────────────────────────────────
SEC_OPEN = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">'
SEC_CLOSE = '</hs:sec>'

# ─── 페이지 설정 단락 (A4 세로, 충청북도 표준 여백) ─────────────────────────
SECPR_PARA = '<hp:p id="0" paraPrIDRef="4" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="60"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4251" footer="4251" gutter="0" left="5527" right="5527" top="4251" bottom="2834"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="12" color="#000000"/><hp:noteSpacing aboveNoteLine="567" belowNoteLine="567" betweenNotes="0"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement position="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="12" color="#000000"/><hp:noteSpacing aboveNoteLine="567" belowNoteLine="567" betweenNotes="0"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement position="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 제목 단락 (중앙 정렬, 굵게 대형) ───────────────────────────────────────
# paraPr=62(CENTER), charPr=95(대형 볼드) - 실제 고교학점제 문서의 메인 타이틀
def make_title(text):
    t = html.escape(text)
    return f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="95"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1800" textheight="1800" baseline="1530" spacing="812" horzpos="0" horzsize="46776" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 부제목 단락 (중앙 정렬, 소형) ─────────────────────────────────────────
# paraPr=62(CENTER), charPr=80(소형 일반)
def make_subtitle(text):
    t = html.escape(text)
    return f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="94"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1300" textheight="1300" baseline="1105" spacing="584" horzpos="0" horzsize="46776" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 부서/기관명 단락 (우측 정렬) ───────────────────────────────────────────
# paraPr=54(RIGHT), charPr=67(14pt 일반)
def make_dept(text):
    t = html.escape(text)
    return f'<hp:p id="0" paraPrIDRef="54" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="67"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" baseline="1275" spacing="900" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 로고 이미지 삽입 ────────────────────────────────────────────────────────
def _get_image_size_px(path):
    """이미지 파일에서 픽셀 크기 추출 (PNG/JPEG 헤더 직접 읽기, PIL 불필요)"""
    try:
        with open(path, 'rb') as f:
            header = f.read(24)
        ext = os.path.splitext(path)[1].lower()
        if ext == '.png' and header[:8] == b'\x89PNG\r\n\x1a\n':
            w, h = struct.unpack('>II', header[16:24])
            return w, h
        elif ext in ('.jpg', '.jpeg') and header[:2] == b'\xff\xd8':
            with open(path, 'rb') as f:
                f.read(2)
                while True:
                    marker, = struct.unpack('>H', f.read(2))
                    size, = struct.unpack('>H', f.read(2))
                    if marker in (0xFFC0, 0xFFC1, 0xFFC2):
                        f.read(1)
                        h, w = struct.unpack('>HH', f.read(4))
                        return w, h
                    f.read(size - 2)
        elif ext == '.bmp' and header[:2] == b'BM':
            w, h = struct.unpack('<II', header[18:26])
            return w, abs(h)
    except Exception:
        pass
    return 500, 200  # 기본값

def inject_logo(tmp_dir, logo_path):
    """사용자 로고로 템플릿의 image1(헤더 로고)을 교체. content.hpf 업데이트."""
    ext = os.path.splitext(logo_path)[1].lower()
    if ext == '.jpeg':
        ext = '.jpg'
    media_map = {'.png': 'image/png', '.jpg': 'image/jpg', '.bmp': 'image/bmp'}
    media_type = media_map.get(ext, 'image/png')

    # 기존 image1.jpg 삭제 (확장자가 다른 경우)
    old_jpg = os.path.join(tmp_dir, 'BinData', 'image1.jpg')
    if os.path.exists(old_jpg) and ext != '.jpg':
        os.remove(old_jpg)

    new_name = f'image1{ext}'
    dest = os.path.join(tmp_dir, 'BinData', new_name)
    shutil.copy2(logo_path, dest)

    # content.hpf에서 image1 항목 업데이트
    hpf_path = os.path.join(tmp_dir, 'Contents', 'content.hpf')
    with open(hpf_path, 'r', encoding='utf-8') as f:
        hpf = f.read()
    hpf = re.sub(r'<opf:item id="image1".*?/>',
                 f'<opf:item id="image1" href="BinData/{new_name}" media-type="{media_type}" isEmbeded="1"/>',
                 hpf, flags=re.DOTALL)
    with open(hpf_path, 'w', encoding='utf-8') as f:
        f.write(hpf)


def _get_template_secpr(logo_w_px=None, logo_h_px=None):
    """템플릿 section0.xml의 첫 번째 hp:p (SECPR, 헤더 포함)을 추출.
    로고 크기 제공 시 헤더 내 image1 크기 정보를 업데이트."""
    with zipfile.ZipFile(TEMPLATE_PATH, 'r') as z:
        with z.open('Contents/section0.xml') as f:
            tmpl_sec = f.read().decode('utf-8')
    # hs:sec 여는 태그 끝부분(본문 시작) 찾기
    sec_start = re.search(r'<hs:sec[^>]*>', tmpl_sec)
    body_start = sec_start.end() if sec_start else 0
    # 중첩 <hp:p>/<hp:p > 계층을 추적해 외부 SECPR hp:p의 올바른 닫는 태그를 찾음
    depth = 0
    pos = body_start
    p_end = len(tmpl_sec)
    while pos < len(tmpl_sec):
        next_open_sp = tmpl_sec.find('<hp:p ', pos)
        next_open_gt = tmpl_sec.find('<hp:p>', pos)
        # 둘 중 먼저 나오는 열기 태그
        opens = [x for x in [next_open_sp, next_open_gt] if x != -1]
        next_open = min(opens) if opens else -1
        next_close = tmpl_sec.find('</hp:p>', pos)
        if next_close == -1:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 5
        else:
            depth -= 1
            if depth == 0:
                p_end = next_close + len('</hp:p>')
                break
            pos = next_close + len('</hp:p>')
    secpr = tmpl_sec[:p_end]

    if logo_w_px and logo_h_px:
        cur_w, cur_h = 10783, 2519  # 헤더에서 image1의 표시 크기(유지)
        orig_w, orig_h = logo_w_px * 100, logo_h_px * 100
        sx = cur_w / max(orig_w, 1)
        sy = cur_h / max(orig_h, 1)
        pos = secpr.find('binaryItemIDRef="image1"')
        if pos != -1:
            pic_start = secpr.rfind('<hp:pic', 0, pos)
            pic_end = secpr.find('</hp:pic>', pos) + len('</hp:pic>')
            pic = secpr[pic_start:pic_end]
            pic = re.sub(r'<hp:orgSz[^/]*/>', f'<hp:orgSz width="{orig_w}" height="{orig_h}"/>', pic)
            pic = re.sub(r'<hp:imgClip[^/]*/>', f'<hp:imgClip left="0" right="{orig_w}" top="0" bottom="{orig_h}"/>', pic)
            pic = re.sub(r'<hp:imgDim[^/]*/>', f'<hp:imgDim dimwidth="{orig_w}" dimheight="{orig_h}"/>', pic)
            pic = re.sub(r'<hp:imgRect>.*?</hp:imgRect>',
                         f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{orig_w}" y="0"/>'
                         f'<hc:pt2 x="{orig_w}" y="{orig_h}"/><hc:pt3 x="0" y="{orig_h}"/></hp:imgRect>',
                         pic, flags=re.DOTALL)
            pic = re.sub(r'<hc:scaMatrix e1="[^"]*" e2="0" e3="0" e4="0" e5="[^"]*" e6="0"/>',
                         f'<hc:scaMatrix e1="{sx:.6f}" e2="0" e3="0" e4="0" e5="{sy:.6f}" e6="0"/>',
                         pic)
            secpr = secpr[:pic_start] + pic + secpr[pic_end:]
    return secpr

def make_logo_table(orig_w_px, orig_h_px, dept_text=None, display_w_hwp=18000):
    """표지 하단 로고+부서명 테이블 - image1을 테이블 셀 안에 삽입 (HWP 렌더링 필수).
    dept_text 제공 시 로고 아래 행에 【부서명】 텍스트 추가."""
    orig_w_hwp = orig_w_px * 100
    orig_h_hwp = orig_h_px * 100
    display_h_hwp = max(1000, int(display_w_hwp * orig_h_px / max(orig_w_px, 1)))
    pic_id = _new_id()
    inst = _new_id()
    tbl_id = _new_id()
    sx = display_w_hwp / max(orig_w_hwp, 1)
    sy = display_h_hwp / max(orig_h_hwp, 1)

    tbl_w = 47622
    inner_tbl_w = tbl_w - 282

    pic_xml = (
        f'<hp:pic id="{pic_id}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="{inst}" reverse="0">'
        f'<hp:offset x="0" y="0"/>'
        f'<hp:orgSz width="{orig_w_hwp}" height="{orig_h_hwp}"/>'
        f'<hp:curSz width="{display_w_hwp}" height="{display_h_hwp}"/>'
        f'<hp:flip horizontal="0" vertical="0"/>'
        f'<hp:rotationInfo angle="0" centerX="{display_w_hwp//2}" centerY="{display_h_hwp//2}" rotateimage="1"/>'
        f'<hp:renderingInfo>'
        f'<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'<hc:scaMatrix e1="{sx:.6f}" e2="0" e3="0" e4="0" e5="{sy:.6f}" e6="0"/>'
        f'<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
        f'</hp:renderingInfo>'
        f'<hc:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
        f'<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="{orig_w_hwp}" y="0"/>'
        f'<hc:pt2 x="{orig_w_hwp}" y="{orig_h_hwp}"/><hc:pt3 x="0" y="{orig_h_hwp}"/></hp:imgRect>'
        f'<hp:imgClip left="0" right="{orig_w_hwp}" top="0" bottom="{orig_h_hwp}"/>'
        f'<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:imgDim dimwidth="{orig_w_hwp}" dimheight="{orig_h_hwp}"/>'
        f'<hp:effects/>'
        f'<hp:sz width="{display_w_hwp}" widthRelTo="ABSOLUTE" height="{display_h_hwp}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" '
        f'vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
        f'<hp:shapeComment>그림입니다.</hp:shapeComment>'
        f'</hp:pic>'
    )

    logo_cell_h = display_h_hwp + 282
    logo_row = (
        f'<hp:tr>'
        f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="60">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="114">{pic_xml}<hp:t/></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="{display_h_hwp}" '
        f'textheight="{display_h_hwp}" baseline="{int(display_h_hwp*0.85)}" '
        f'spacing="600" horzpos="0" horzsize="{inner_tbl_w}" flags="393216"/></hp:linesegarray>'
        f'</hp:p></hp:subList>'
        f'<hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
        f'<hp:cellSz width="{tbl_w}" height="{logo_cell_h}"/>'
        f'<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>'
        f'</hp:tr>'
    )

    rows = [logo_row]
    tbl_sz_h = logo_cell_h
    row_cnt = 1

    if dept_text:
        t = html.escape(dept_text)
        label = f'【{t}】' if not dept_text.startswith('【') else t
        dept_cell_h = 1682
        dept_row = (
            f'<hp:tr>'
            f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="60">'
            f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
            f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
            f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="67"><hp:t>{label}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" '
            f'baseline="1275" spacing="900" horzpos="0" horzsize="{inner_tbl_w}" flags="393216"/></hp:linesegarray>'
            f'</hp:p></hp:subList>'
            f'<hp:cellAddr colAddr="0" rowAddr="1"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
            f'<hp:cellSz width="{tbl_w}" height="{dept_cell_h}"/>'
            f'<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>'
            f'</hp:tr>'
        )
        rows.append(dept_row)
        tbl_sz_h += dept_cell_h
        row_cnt = 2

    tbl_height = tbl_sz_h + 566
    tbl_xml = (
        f'<hp:tbl id="{tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" '
        f'rowCnt="{row_cnt}" colCnt="1" cellSpacing="0" borderFillIDRef="60" noAdjust="0">'
        f'<hp:sz width="{tbl_w}" widthRelTo="ABSOLUTE" height="{tbl_sz_h}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" '
        f'vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="283" right="283" top="283" bottom="283"/>'
        f'<hp:inMargin left="141" right="141" top="141" bottom="141"/>'
        f'{"".join(rows)}</hp:tbl>'
    )

    return (
        f'<hp:p id="0" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="52">{tbl_xml}<hp:t/></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="{tbl_height}" '
        f'textheight="{tbl_height}" baseline="{int(tbl_height * 0.85)}" '
        f'spacing="840" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

def make_dept_box(dept_text):
    """표지 하단 【부서명】 텍스트 단락 (중앙 정렬, 괄호 포함)"""
    t = html.escape(dept_text)
    label = f'【{t}】' if not dept_text.startswith('【') else t
    return (f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="67"><hp:t>{label}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" '
            f'baseline="1275" spacing="900" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_dept_right(dept_text):
    """본문 페이지 우측 정렬 부서명 (타이틀 바 아래)"""
    t = html.escape(dept_text)
    return (f'<hp:p id="2147483648" paraPrIDRef="54" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="67"><hp:t>{t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" '
            f'baseline="1275" spacing="900" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

# ─── 대제목 컨테이너 (실제 교육청 서식 그대로) ──────────────────────────────
# 구조: 남색 정사각형 박스(로마자) + 흰색 바(제목 텍스트) + 파란 구분선
# 원본: 2026 고등학교 교육과정·고교학점제 현장지원단 운영 계획 section0.xml
_MAJOR_TEMPLATE = ('<hp:p id="2147483648" paraPrIDRef="67" styleIDRef="68" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="1">'
    '<hp:container id="__CID__" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="__INST1__">'
    '<hp:offset x="0" y="0"/><hp:orgSz width="48759" height="2248"/><hp:curSz width="48178" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="24089" centerY="1124" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    # 첫 번째 rect: 남색 박스 (로마자)
    '<hp:rect id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST2__" ratio="0">'
    '<hp:offset x="0" y="4294966709"/><hp:orgSz width="2834" height="2834"/><hp:curSz width="2800" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="1092" centerY="1123" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="-587"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="0.780169" e2="0" e3="0" e4="0" e5="0.792872" e6="587"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#000000" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#18304B" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hp:drawText lastWidth="2185" name="" editable="0">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    '<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="68" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="2"><hp:t>__ROMAN__</hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" baseline="1275" spacing="900" horzpos="0" horzsize="1616" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList>'
    '<hp:textMargin left="283" right="283" top="283" bottom="283"/>'
    '</hp:drawText>'
    '<hc:pt0 x="0" y="0"/><hc:pt1 x="2834" y="0"/><hc:pt2 x="2834" y="2834"/><hc:pt3 x="0" y="2834"/>'
    '</hp:rect>'
    # 두 번째 rect: 흰색 바 (제목 텍스트)
    '<hp:rect id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST3__" ratio="0">'
    '<hp:offset x="2834" y="63"/><hp:orgSz width="45925" height="2184"/><hp:curSz width="45377" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="22689" centerY="1123" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="2834" e4="0" e5="1" e6="63"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="-33.769234" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1.028846" e6="-63"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#000000" width="33" style="NONE" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#FFFFFF" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hp:drawText lastWidth="45378" name="" editable="0">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    '<hp:p id="2147483648" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="3"><hp:t>__TITLE__</hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1600" textheight="1600" baseline="1360" spacing="960" horzpos="0" horzsize="44812" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList>'
    '<hp:textMargin left="283" right="283" top="283" bottom="283"/>'
    '</hp:drawText>'
    '<hc:pt0 x="0" y="0"/><hc:pt1 x="45925" y="0"/><hc:pt2 x="45925" y="2184"/><hc:pt3 x="0" y="2184"/>'
    '</hp:rect>'
    # 구분선
    '<hp:line id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST4__" isReverseHV="0">'
    '<hp:offset x="2834" y="2247"/><hp:orgSz width="100" height="100"/><hp:curSz width="98" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="22402" centerY="0" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="2834" e4="0" e5="1" e6="2247"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="-33.769234" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="453.440002" e2="0" e3="0" e4="0" e5="0" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#173876" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hc:startPt x="0" y="0"/><hc:endPt x="100" y="100"/>'
    '</hp:line>'
    '<hp:sz width="48178" widthRelTo="ABSOLUTE" height="2248" heightRelTo="ABSOLUTE" protect="0"/>'
    '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
    '</hp:container>'
    '<hp:t> </hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="2248" textheight="2248" baseline="1911" spacing="780" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
    '</hp:p>')

# ─── 붙임 헤더 (전체 너비 남색 바, 흰색 텍스트) ─────────────────────────────
# 대제목(좌측 로마자 박스+흰바 분리)과 달리, 단일 전폭 rect로 구성.
# charPrIDRef="2": 흰색 15pt — 남색 배경 위에 "붙임 N. 제목" 표시.
_ATTACHMENT_TEMPLATE = (
    '<hp:p id="2147483648" paraPrIDRef="67" styleIDRef="68" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="1">'
    '<hp:container id="__CID__" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="__INST1__">'
    '<hp:offset x="0" y="0"/><hp:orgSz width="48759" height="2248"/><hp:curSz width="48178" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="24089" centerY="1124" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:rect id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST2__" ratio="0">'
    '<hp:offset x="0" y="63"/><hp:orgSz width="48759" height="2184"/><hp:curSz width="48178" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="24089" centerY="1092" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="63"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#000000" width="33" style="NONE" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#18304B" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hp:drawText lastWidth="48178" name="" editable="0">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    '<hp:p id="2147483648" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="2"><hp:t>__ATTACH_TEXT__</hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1600" textheight="1600" baseline="1360" spacing="960" horzpos="0" horzsize="47612" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList>'
    '<hp:textMargin left="400" right="283" top="283" bottom="283"/>'
    '</hp:drawText>'
    '<hc:pt0 x="0" y="0"/><hc:pt1 x="48759" y="0"/><hc:pt2 x="48759" y="2184"/><hc:pt3 x="0" y="2184"/>'
    '</hp:rect>'
    '<hp:sz width="48178" widthRelTo="ABSOLUTE" height="2248" heightRelTo="ABSOLUTE" protect="0"/>'
    '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
    '</hp:container>'
    '<hp:t> </hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="2248" textheight="2248" baseline="1911" spacing="780" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
    '</hp:p>')

_id_counter = [10000]

def _new_id():
    _id_counter[0] += random.randint(100, 999)
    return _id_counter[0]

def make_attachment_heading(num, title):
    """붙임 헤더 단락 생성 (전폭 남색 바, 흰색 텍스트 '붙임 N. 제목')"""
    label = f'붙임 {num}.'
    text = html.escape(f'{label}  {title}' if title else label)
    cid   = _new_id()
    inst1 = _new_id()
    inst2 = _new_id()
    return (_ATTACHMENT_TEMPLATE
            .replace('__CID__',        str(cid))
            .replace('__INST1__',      str(inst1))
            .replace('__INST2__',      str(inst2))
            .replace('__ATTACH_TEXT__', text))

def make_major_heading(roman, title):
    """대제목 컨테이너 단락 생성 (남색 박스 + 파란 구분선 + 제목 텍스트)"""
    t = html.escape(title)
    r = html.escape(roman)
    cid = _new_id()
    inst1 = _new_id()
    inst2 = _new_id()
    inst3 = _new_id()
    inst4 = _new_id()
    return (_MAJOR_TEMPLATE
            .replace('__CID__', str(cid))
            .replace('__INST1__', str(inst1))
            .replace('__INST2__', str(inst2))
            .replace('__INST3__', str(inst3))
            .replace('__INST4__', str(inst4))
            .replace('__ROMAN__', r)
            .replace('__TITLE__', t))

# ─── 불릿 단락들 ──────────────────────────────────────────────────────────
def make_bullet1(text):
    """◦ 수준1 불릿 단락 (paraPr=85, charPr=37+94)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="85" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="37"><hp:t> ◦ </hp:t></hp:run>'
            f'<hp:run charPrIDRef="94"><hp:t>{t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_bullet2(text):
    """◦ 수준2 불릿 단락 (paraPr=49, charPr=89, 들여쓰기)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t> ◦ {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_dash(text):
    """- 대시 불릿 단락 (paraPr=49, charPr=89)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t>   - {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_sub_heading(text):
    """□ 소제목 단락 (paraPr=49, charPr=90, 굵게)"""
    t = html.escape(text)
    prefix = '' if text.startswith('□') else '□ '
    return (f'<hp:p id="2147483648" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="90"><hp:t>{prefix}{t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_note(text):
    """※ 주석 단락 (paraPr=49, charPr=89)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t>※ {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

# ─── 추가 borderFill XML (header.xml에 주입, 항상 추가) ──────────────────────
# 56=파랑(#4E9FD7, 표지바), 57=분홍(#AC1F8D, 표지바), 58=노랑(#BCBE50, 표지바)
# 59=연파랑(#BDD7EE, 표 헤더), 60=테두리없음/배경없음(로고 테이블)
_EXTRA_FILLS_XML = (
    '<hh:borderFill id="56" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    '<hh:leftBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:rightBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:topBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:bottomBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#4E9FD7" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '</hh:borderFill>'
    '<hh:borderFill id="57" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    '<hh:leftBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:rightBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:topBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:bottomBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#AC1F8D" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '</hh:borderFill>'
    '<hh:borderFill id="58" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    '<hh:leftBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:rightBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:topBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:bottomBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#BCBE50" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '</hh:borderFill>'
    '<hh:borderFill id="59" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    '<hh:leftBorder type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hh:rightBorder type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hh:topBorder type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hh:bottomBorder type="SOLID" width="0.12 mm" color="#000000"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#BDD7EE" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '</hh:borderFill>'
    '<hh:borderFill id="60" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
    '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    '<hh:leftBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:rightBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:topBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hh:bottomBorder type="NONE" width="0.12 mm" color="#000000"/>'
    '<hc:fillBrush/>'
    '</hh:borderFill>'
)
_COVER_BAR_FILLS_XML = _EXTRA_FILLS_XML  # 하위 호환 별칭

def make_cover_bar_table(title_text, center_h=5690):
    """표지 색깔 바 + 제목 박스 테이블 생성
    구조: [파랑/분홍/노랑 얇은 바] + [제목 텍스트 merged cell] + [파랑/분홍/노랑 얇은 바]
    borderFill IDs 56(파랑) 57(분홍) 58(노랑) — build_hwpx에서 header.xml에 주입됨
    center_h: 가운데 제목 셀 높이 (표지=5690, 본문 헤더=4400)
    """
    t = html.escape(title_text)
    tbl_id = _new_id()
    tbl_w = 47622
    col_w = tbl_w // 3
    col_widths = [col_w, col_w, tbl_w - col_w * 2]
    bar_fill_ids = [56, 57, 58]

    def _bar_row(row_idx, row_h):
        tcs = []
        for ci, (w, fid) in enumerate(zip(col_widths, bar_fill_ids)):
            inner_w = max(100, w - 282)
            tcs.append(
                f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{fid}">'
                f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
                f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
                f'<hp:p id="2147483648" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                f'<hp:run charPrIDRef="94"/>'
                f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="50" textheight="50" '
                f'baseline="43" spacing="28" horzpos="0" horzsize="{inner_w}" flags="393216"/></hp:linesegarray>'
                f'</hp:p></hp:subList>'
                f'<hp:cellAddr colAddr="{ci}" rowAddr="{row_idx}"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                f'<hp:cellSz width="{w}" height="{row_h}"/>'
                f'<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>'
            )
        return f'<hp:tr>{"".join(tcs)}</hp:tr>'

    title_cell_h = center_h
    inner_w = max(100, tbl_w - 282)
    title_row = (
        f'<hp:tr>'
        f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1">'
        f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" '
        f'linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="95"><hp:t>{t}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1800" textheight="1800" '
        f'baseline="1530" spacing="812" horzpos="0" horzsize="{inner_w}" flags="393216"/></hp:linesegarray>'
        f'</hp:p></hp:subList>'
        f'<hp:cellAddr colAddr="0" rowAddr="1"/><hp:cellSpan colSpan="3" rowSpan="1"/>'
        f'<hp:cellSz width="{tbl_w}" height="{title_cell_h}"/>'
        f'<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>'
        f'</hp:tr>'
    )

    row0_h, row2_h = 419, 363
    tbl_sz_h = row0_h + title_cell_h + row2_h
    tbl_lineseg_h = tbl_sz_h + 566

    tbl_xml = (
        f'<hp:tbl id="{tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
        f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" '
        f'rowCnt="3" colCnt="3" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
        f'<hp:sz width="{tbl_w}" widthRelTo="ABSOLUTE" height="{tbl_sz_h}" heightRelTo="ABSOLUTE" protect="0"/>'
        f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" '
        f'vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
        f'<hp:outMargin left="283" right="283" top="283" bottom="283"/>'
        f'<hp:inMargin left="141" right="141" top="141" bottom="141"/>'
        f'{_bar_row(0, row0_h)}{title_row}{_bar_row(2, row2_h)}'
        f'</hp:tbl>'
    )

    return (
        f'<hp:p id="0" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="52">{tbl_xml}<hp:t/></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="{tbl_lineseg_h}" '
        f'textheight="{tbl_lineseg_h}" baseline="{int(tbl_lineseg_h * 0.85)}" '
        f'spacing="840" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
        f'</hp:p>'
    )

def make_body_title_bar(title_text):
    """본문 1페이지 상단 소형 제목 바 (표지 바와 동일 구조, 제목 셀만 작음)"""
    return make_cover_bar_table(title_text, center_h=4400)

# ─── 빈 줄 ───────────────────────────────────────────────────────────────
SPACER_PARA = ('<hp:p id="2147483648" paraPrIDRef="66" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
               '<hp:run charPrIDRef="142"/>'
               '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
               '</hp:p>')

SMALL_SPACER = ('<hp:p id="0" paraPrIDRef="46" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                '<hp:run charPrIDRef="51"/>'
                '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="700" textheight="700" baseline="595" spacing="420" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
                '</hp:p>')

# 페이지 강제 전환 (표지 → 본문)
PAGE_BREAK_PARA = ('<hp:p id="0" paraPrIDRef="8" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0">'
                   '<hp:run charPrIDRef="94"><hp:t> </hp:t></hp:run>'
                   '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
                   '</hp:p>')

# ─── 표(hp:tbl) 생성 ─────────────────────────────────────────────────────
def make_table(rows):
    """표 단락 생성. rows = [['헤더1','헤더2',...], ['값1','값2',...], ...]"""
    if not rows:
        return ''
    col_cnt = max(len(r) for r in rows)
    row_cnt = len(rows)
    tbl_id = _new_id()

    total_w = 47622
    # 열 너비: 각 열의 최대 텍스트 길이에 비례해서 배분 (최소 3000 단위)
    col_max_len = []
    for ci in range(col_cnt):
        max_len = max(len((row[ci] if ci < len(row) else '').strip()) for row in rows)
        col_max_len.append(max(max_len, 2))
    total_len = sum(col_max_len)
    min_w = 3000
    col_widths = [max(min_w, int(total_w * l / total_len)) for l in col_max_len]
    # 마지막 열로 나머지 흡수 (반올림 오차 조정)
    col_widths[-1] = max(min_w, total_w - sum(col_widths[:-1]))

    # 행당 실제 높이: 셀 내용(1400) + 상하 cellMargin(141*2) = 1682
    row_h = 1682
    tbl_sz_height = row_cnt * row_h          # <hp:sz height> (테이블 내부 순수 높이)
    tbl_height = tbl_sz_height + 566         # lineseg vertsize (outMargin 상하 283*2 포함)

    tr_xmls = []
    for ri, row in enumerate(rows):
        is_header = (ri == 0)
        fill_ref = '59' if is_header else '3'   # 59=연파랑 헤더, 3=테두리 일반
        char_ref = '3' if is_header else '94'
        tc_xmls = []
        for ci in range(col_cnt):
            cell_text = (row[ci] if ci < len(row) else '').strip() or ' '
            t = html.escape(str(cell_text))
            w = col_widths[ci]
            inner_w = max(100, w - 282)  # cellMargin left(141) + right(141) = 282
            tc_xml = (f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{fill_ref}">'
                      f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
                      f'<hp:p id="2147483648" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                      f'<hp:run charPrIDRef="{char_ref}"><hp:t>{t}</hp:t></hp:run>'
                      f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="600" horzpos="0" horzsize="{inner_w}" flags="393216"/></hp:linesegarray>'
                      f'</hp:p></hp:subList>'
                      f'<hp:cellAddr colAddr="{ci}" rowAddr="{ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                      f'<hp:cellSz width="{w}" height="1400"/>'
                      f'<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>')
            tc_xmls.append(tc_xml)
        tr_xmls.append(f'<hp:tr>{"".join(tc_xmls)}</hp:tr>')

    tbl_xml = (f'<hp:tbl id="{tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="{row_cnt}" colCnt="{col_cnt}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
               f'<hp:sz width="{total_w}" widthRelTo="ABSOLUTE" height="{tbl_sz_height}" heightRelTo="ABSOLUTE" protect="0"/>'
               f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
               f'<hp:outMargin left="283" right="283" top="283" bottom="283"/>'
               f'<hp:inMargin left="141" right="141" top="141" bottom="141"/>'
               f'{"".join(tr_xmls)}</hp:tbl>')

    return (f'<hp:p id="0" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="52">{tbl_xml}<hp:t/></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="{tbl_height}" textheight="{tbl_height}" baseline="{int(tbl_height * 0.85)}" spacing="840" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

# ─── 마크다운 파서 ─────────────────────────────────────────────────────────
ROMAN_NUMS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ']

def parse_markdown(md_text):
    """마크다운 텍스트를 (type, content) 리스트로 파싱"""
    elements = []
    lines = md_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        if line.startswith('제목:'):
            elements.append(('title', line[3:].strip()))
        elif line.startswith('부제목:'):
            elements.append(('subtitle', line[4:].strip()))
        elif line.startswith('부서:') or line.startswith('기관:'):
            elements.append(('dept', line[3:].strip()))
        elif line.startswith('대제목:'):
            text = line[4:].strip()
            # 로마자 접두어 감지
            roman_match = re.match(r'^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩivxlcdmIVXLCDM]+)[\s.]\s*(.*)', text)
            if roman_match:
                roman = roman_match.group(1)
                title = roman_match.group(2).strip()
            else:
                roman = None
                title = text
            elements.append(('major_heading', (roman, title)))
        elif line.startswith('붙임:'):
            elements.append(('attachment_heading', line[4:].strip()))
        elif line.startswith('소제목:'):
            elements.append(('sub_heading', line[4:].strip()))
        elif line.strip() == '표:':
            # 다음 줄부터 표 데이터 수집
            table_rows = []
            i += 1
            while i < len(lines):
                tline = lines[i].strip()
                if not tline:
                    break
                # 구분선 스킵 (--- 또는 |---|)
                if re.match(r'^[-|: ]+$', tline):
                    i += 1
                    continue
                if '|' in tline:
                    cells = [c.strip() for c in tline.strip('|').split('|')]
                    table_rows.append(cells)
                i += 1
            if table_rows:
                elements.append(('table', table_rows))
            continue
        elif re.match(r'^[◦○]\s', line):
            text = re.sub(r'^[◦○]\s*', '', line).strip()
            elements.append(('bullet1', text))
        elif re.match(r'^\s{2,}[◦○•]\s', line):
            text = re.sub(r'^\s+[◦○•]\s*', '', line).strip()
            elements.append(('bullet2', text))
        elif re.match(r'^\s{2,}-\s', line):
            text = re.sub(r'^\s+-\s*', '', line).strip()
            elements.append(('dash', text))
        elif line.startswith('- '):
            elements.append(('bullet1', line[2:].strip()))
        elif line.startswith('• '):
            elements.append(('bullet1', line[2:].strip()))
        elif line.startswith('※'):
            elements.append(('note', line[1:].strip()))
        elif not line.strip():
            if elements and elements[-1][0] != 'spacer':
                elements.append(('spacer', ''))
        elif line.strip():
            elements.append(('bullet1', line.strip()))

        i += 1
    return elements


def assign_roman_numerals(elements):
    """대제목에 로마자 자동 배정, 붙임에 순번 자동 배정"""
    roman_counter = 0
    attach_counter = 0
    result = []
    for kind, content in elements:
        if kind == 'major_heading':
            roman, title = content
            if roman is None:
                roman = ROMAN_NUMS[roman_counter] if roman_counter < len(ROMAN_NUMS) else str(roman_counter + 1)
            roman_counter += 1
            result.append((kind, (roman, title)))
        elif kind == 'attachment_heading':
            attach_counter += 1
            result.append((kind, (attach_counter, content)))
        else:
            result.append((kind, content))
    return result


# ─── hwpx 빌더 메인 함수 ──────────────────────────────────────────────────
_COVER_TYPES = {'title', 'subtitle', 'dept'}

def build_hwpx(md_text, output_path, logo_path=None):
    """마크다운 텍스트 → hwpx 파일 생성. logo_path: 학교 로고 이미지 파일 경로 (선택)"""
    elements = parse_markdown(md_text)
    elements = assign_roman_numerals(elements)

    # 로고 파일 유효성 확인 및 크기 읽기
    logo_valid = logo_path and os.path.isfile(logo_path)
    logo_w_px, logo_h_px = _get_image_size_px(logo_path) if logo_valid else (500, 200)

    paras = [SECPR_PARA]

    # 표지 요소(제목/부제목/부서)를 앞에서 분리
    first_real = next((k for k, _ in elements if k != 'spacer'), None)
    has_cover = first_real in _COVER_TYPES

    if has_cover:
        cover_elems = []
        i = 0
        while i < len(elements):
            k, v = elements[i]
            if k in _COVER_TYPES:
                cover_elems.append((k, v))
            elif k != 'spacer':
                break
            i += 1
        body_elems = elements[i:]

        # 표지: 상단 여백 → 색깔바+제목 박스 → 부제목 → (여백) → 부서
        title_val = next((v for k, v in cover_elems if k == 'title'), '')
        subtitle_list = [(k, v) for k, v in cover_elems if k == 'subtitle']
        dept_list = [(k, v) for k, v in cover_elems if k == 'dept']

        for _ in range(8):
            paras.append(SPACER_PARA)
        paras.append(make_cover_bar_table(title_val))
        for _, content in subtitle_list:
            paras.append(make_subtitle(content))
        # 표지 하단: 로고+부서명 테이블 (로고 없으면 부서명 단락만)
        if dept_list:
            dept_val = dept_list[0][1]
            for _ in range(6):
                paras.append(SPACER_PARA)
            if logo_valid:
                paras.append(make_logo_table(logo_w_px, logo_h_px, dept_val, 18000))
            else:
                paras.append(make_dept_box(dept_val))
        # 본문은 다음 페이지부터 (본문 상단에 소형 제목 바 + 우측 부서명)
        if body_elems:
            paras.append(PAGE_BREAK_PARA)
            if title_val:
                paras.append(make_body_title_bar(title_val))
            if dept_list:
                paras.append(make_dept_right(dept_list[0][1]))
    else:
        body_elems = elements

    prev_kind = None
    for kind, content in body_elems:
        if kind == 'title':
            paras.append(SPACER_PARA)
            paras.append(make_title(content))
        elif kind == 'subtitle':
            paras.append(make_subtitle(content))
        elif kind == 'dept':
            paras.append(make_dept(content))
        elif kind == 'major_heading':
            roman, title = content
            if prev_kind not in (None, 'title', 'subtitle', 'dept'):
                paras.append(SPACER_PARA)
            paras.append(SMALL_SPACER)
            paras.append(make_major_heading(roman, title))
        elif kind == 'attachment_heading':
            num, title = content
            if prev_kind not in (None, 'title', 'subtitle', 'dept'):
                paras.append(SPACER_PARA)
            paras.append(SMALL_SPACER)
            paras.append(make_attachment_heading(num, title))
        elif kind == 'sub_heading':
            paras.append(make_sub_heading(content))
        elif kind == 'bullet1':
            paras.append(make_bullet1(content))
        elif kind == 'bullet2':
            paras.append(make_bullet2(content))
        elif kind == 'dash':
            paras.append(make_dash(content))
        elif kind == 'note':
            paras.append(make_note(content))
        elif kind == 'table':
            paras.append(make_table(content))
        elif kind == 'spacer':
            paras.append(SPACER_PARA)

        prev_kind = kind

    paras.append(SPACER_PARA)

    section_xml = SEC_OPEN + ''.join(paras) + SEC_CLOSE

    tmp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(TEMPLATE_PATH, 'r') as z:
            z.extractall(tmp_dir)

        # header.xml에 borderFill 56-59 추가 (표지 바 + 표 헤더 색상)
        hdr_path = os.path.join(tmp_dir, 'Contents', 'header.xml')
        with open(hdr_path, 'r', encoding='utf-8') as f:
            hdr = f.read()
        hdr = hdr.replace('borderFills itemCnt="55"', 'borderFills itemCnt="60"', 1)
        hdr = hdr.replace('</hh:borderFills>', _EXTRA_FILLS_XML + '</hh:borderFills>', 1)
        with open(hdr_path, 'w', encoding='utf-8') as f:
            f.write(hdr)

        # 로고 이미지 파일 BinData에 복사 + content.hpf 등록
        if logo_valid:
            inject_logo(tmp_dir, logo_path)

        sec_path = os.path.join(tmp_dir, 'Contents', 'section0.xml')
        with open(sec_path, 'w', encoding='utf-8') as f:
            f.write(section_xml)

        if os.path.exists(output_path):
            os.remove(output_path)

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for root, dirs, files in os.walk(tmp_dir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.relpath(fpath, tmp_dir)
                    zout.write(fpath, arcname)

        return output_path
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == '__main__':
    import sys, json
    if len(sys.argv) < 3:
        print(json.dumps({'ok': False, 'error': 'Usage: python hwpx_builder.py <markdown_file> <output.hwpx>'}))
        sys.exit(1)
    try:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            md = f.read()
        logo = sys.argv[3] if len(sys.argv) > 3 else None
        result = build_hwpx(md, sys.argv[2], logo)
        print(json.dumps({'ok': True, 'path': result, 'savedTo': result}))
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        sys.exit(1)
