"""Restricted Assimp import: only files in this upload's temporary directory are readable."""
import ctypes as C
import ctypes.util
import os
import sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
source=(root/sys.argv[2]).resolve()
if not source.is_relative_to(root):
    raise SystemExit('Invalid source path')
lib=C.CDLL(ctypes.util.find_library('assimp'))
class File(C.Structure): pass
Read=C.CFUNCTYPE(C.c_size_t,C.POINTER(File),C.c_void_p,C.c_size_t,C.c_size_t)
Write=Read
Tell=C.CFUNCTYPE(C.c_size_t,C.POINTER(File))
Seek=C.CFUNCTYPE(C.c_int,C.POINTER(File),C.c_size_t,C.c_int)
Flush=C.CFUNCTYPE(None,C.POINTER(File))
File._fields_=[('ReadProc',Read),('WriteProc',Write),('TellProc',Tell),('FileSizeProc',Tell),('SeekProc',Seek),('FlushProc',Flush),('UserData',C.c_void_p)]
class IO(C.Structure):pass
Open=C.CFUNCTYPE(C.c_void_p,C.POINTER(IO),C.c_char_p,C.c_char_p)
Close=C.CFUNCTYPE(None,C.POINTER(IO),C.POINTER(File))
IO._fields_=[('OpenProc',Open),('CloseProc',Close),('UserData',C.c_void_p)]
handles={}
@Read
def read(ptr,buffer,size,count):
    try:
        if not size or size*count>64*1024*1024:return 0
        data=handles[C.addressof(ptr.contents)][0].read(size*count)
        C.memmove(buffer,data,len(data));return len(data)//size
    except Exception:return 0
@Write
def write(*args):return 0
@Tell
def tell(ptr):
    try:return handles[C.addressof(ptr.contents)][0].tell()
    except Exception:return 0
@Tell
def length(ptr):
    try:return os.fstat(handles[C.addressof(ptr.contents)][0].fileno()).st_size
    except Exception:return 0
@Seek
def seek(ptr,offset,origin):
    try:
        stream=handles[C.addressof(ptr.contents)][0]
        stream.seek(-offset if origin==2 else offset,origin)
        return 0
    except Exception:return -1
@Flush
def flush(ptr):pass
@Open
def open_file(io,path,mode):
    try:
        if mode not in (b'rb',b'r',b'rt'):return None
        value=Path(os.fsdecode(path))
        value=(value if value.is_absolute() else root/value).resolve()
        if not value.is_relative_to(root) or not value.is_file():return None
        stream=value.open('rb')
        file=File(read,write,tell,length,seek,flush,None)
        address=C.addressof(file);handles[address]=(stream,file)
        return address
    except Exception:return None
@Close
def close_file(io,ptr):
    entry=handles.pop(C.addressof(ptr.contents),None)
    if entry:entry[0].close()
io=IO(open_file,close_file,None)
lib.aiImportFileEx.argtypes=[C.c_char_p,C.c_uint,C.POINTER(IO)];lib.aiImportFileEx.restype=C.c_void_p
lib.aiExportScene.argtypes=[C.c_void_p,C.c_char_p,C.c_char_p,C.c_uint];lib.aiExportScene.restype=C.c_int
lib.aiReleaseImport.argtypes=[C.c_void_p]
os.chdir(root)
# Triangulate, join vertices, generate smooth normals, validate structure, improve locality.
scene=lib.aiImportFileEx(os.fsencode(source),0x8|0x2|0x40|0x400|0x800,C.byref(io))
if not scene:raise SystemExit('Model parser rejected this file')
try:
    if lib.aiExportScene(scene,b'gltf2',os.fsencode(root/'normalized.gltf'),0)!=0:
        raise SystemExit('Model could not be normalized')
finally:
    lib.aiReleaseImport(scene)
    for stream,file in handles.values():stream.close()
