import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { websocket } from '@/lib/websocket';
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Upload, 
  Play, 
  Pause, 
  Download, 
  Send,
  User,
  Clock,
  FileAudio,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Remark {
  id: string;
  serviceRequestId: string;
  userId: string;
  userName: string;
  userRole: string;
  remarkText: string;
  isSystemGenerated: boolean;
  createdAt: string;
}

interface Recording {
  id: string;
  serviceRequestId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  durationSeconds?: number;
  mimeType: string;
  createdAt: string;
}

interface RemarksTimelineProps {
  serviceRequestId: string;
}

export default function RemarksTimeline({ serviceRequestId }: RemarksTimelineProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newRemark, setNewRemark] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioBlobs, setAudioBlobs] = useState<Map<string, string>>(new Map()); // recordingId -> blobUrl
  const [loadingAudio, setLoadingAudio] = useState<Set<string>>(new Set()); // recordingIds being loaded
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch remarks
  const { data: remarks = [], isLoading: remarksLoading } = useQuery<Remark[]>({
    queryKey: [`/api/service-requests/${serviceRequestId}/remarks-list`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/service-requests/${serviceRequestId}/remarks-list`);
      return res.json();
    },
  });

  // Fetch recordings
  const { data: recordings = [], isLoading: recordingsLoading } = useQuery<Recording[]>({
    queryKey: [`/api/service-requests/${serviceRequestId}/recordings`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/service-requests/${serviceRequestId}/recordings`);
      return res.json();
    },
  });

  // Add remark mutation
  const addRemarkMutation = useMutation({
    mutationFn: async (remarkText: string) => {
      const res = await apiRequest('POST', `/api/service-requests/${serviceRequestId}/remarks-list`, { remarkText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/remarks-list`] });
      setNewRemark('');
      toast({ title: 'Remark added', description: 'Your remark has been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add remark.', variant: 'destructive' });
    },
  });

  // Upload recording mutation
  const uploadRecordingMutation = useMutation({
    mutationFn: async (file: File | Blob) => {
      // Compress audio before upload
      const compressedFile = await compressAudio(file instanceof File ? file : file);
      
      const formData = new FormData();
      const fileName = file instanceof File ? file.name : `recording_${Date.now()}.webm`;
      formData.append('audio', compressedFile, fileName);
      formData.append('originalSize', String(file.size));
      formData.append('compressedSize', String(compressedFile.size));
      
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/service-requests/${serviceRequestId}/recordings`, {
        method: 'POST',
        headers: {
          'x-user-id': token || '',
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/recordings`] });
      setRecordedBlob(null);
      setRecordingDuration(0);
      toast({ title: 'Recording uploaded', description: 'Your compressed recording has been saved.' });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: 'Failed to upload recording.', variant: 'destructive' });
    },
  });

  // WebSocket listeners for real-time updates
  useEffect(() => {
    const handleRemarkAdded = (data: any) => {
      if (data.serviceRequestId === serviceRequestId) {
        queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/remarks-list`] });
      }
    };

    const handleRecordingAdded = (data: any) => {
      if (data.serviceRequestId === serviceRequestId) {
        queryClient.invalidateQueries({ queryKey: [`/api/service-requests/${serviceRequestId}/recordings`] });
      }
    };

    websocket.on('remark_added', handleRemarkAdded);
    websocket.on('recording_added', handleRecordingAdded);

    return () => {
      websocket.off('remark_added', handleRemarkAdded);
      websocket.off('recording_added', handleRecordingAdded);
    };
  }, [serviceRequestId, queryClient]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({ 
        title: 'Recording Error', 
        description: 'Could not access microphone. Please check permissions.', 
        variant: 'destructive' 
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadRecordingMutation.mutate(file);
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'coordinator':
        return 'bg-purple-100 text-purple-800';
      case 'technician':
        return 'bg-green-100 text-green-800';
      case 'client':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Load audio file with authentication and create blob URL
  const loadAudioFile = async (recordingId: string) => {
    if (audioBlobs.has(recordingId)) {
      return audioBlobs.get(recordingId);
    }

    if (loadingAudio.has(recordingId)) {
      return null; // Already loading
    }

    setLoadingAudio(prev => new Set(prev).add(recordingId));

    try {
      const token = localStorage.getItem('auth_token');
      console.log('[AUDIO LOAD] Loading audio for recording:', recordingId);
      console.log('[AUDIO LOAD] Token available:', !!token);
      
      const response = await fetch(`/api/recordings/${recordingId}/download`, {
        headers: {
          'x-user-id': token || '',
        },
      });

      console.log('[AUDIO LOAD] Response status:', response.status);
      console.log('[AUDIO LOAD] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AUDIO LOAD] Response not ok:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      console.log('[AUDIO LOAD] Blob received:', blob.size, 'bytes, type:', blob.type);
      
      const blobUrl = URL.createObjectURL(blob);
      
      setAudioBlobs(prev => new Map(prev).set(recordingId, blobUrl));
      console.log('[AUDIO LOAD] Blob URL created:', blobUrl);
      
      return blobUrl;
    } catch (error) {
      console.error('[AUDIO LOAD] Failed to load audio:', error);
      toast({
        title: 'Audio Load Error',
        description: `Failed to load audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoadingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(recordingId);
        return newSet;
      });
    }
  };

  // Handle audio play event
  const handleAudioPlay = (recordingId: string) => {
    setPlayingId(recordingId);
  };

  // Handle audio pause/end event
  const handleAudioPause = () => {
    setPlayingId(null);
  };

  // Compress audio file before upload
  const compressAudio = async (audioBlob: Blob): Promise<Blob> => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create offline context with lower sample rate for compression
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        Math.ceil(audioBuffer.duration * 22050), // Reduce to 22kHz sample rate
        22050
      );
      
      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      // Render compressed audio
      const compressedBuffer = await offlineContext.startRendering();
      
      // Convert back to blob with lower quality
      const compressedBlob = await new Promise<Blob>((resolve) => {
        const wavRecorder = (buffer: AudioBuffer) => {
          const length = buffer.length;
          const numberOfChannels = buffer.numberOfChannels;
          const sampleRate = buffer.sampleRate;
          const bytesPerSample = 2; // 16-bit
          const blockAlign = numberOfChannels * bytesPerSample;
          const byteRate = sampleRate * blockAlign;
          const dataSize = length * blockAlign;
          const bufferSize = 44 + dataSize;
          
          const arrayBuffer = new ArrayBuffer(bufferSize);
          const view = new DataView(arrayBuffer);
          
          // WAV header
          const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          };
          
          writeString(0, 'RIFF');
          view.setUint32(4, bufferSize - 8, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true); // PCM format
          view.setUint16(22, numberOfChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true); // bits per sample
          writeString(36, 'data');
          view.setUint32(40, dataSize, true);
          
          // Audio data
          let offset = 44;
          for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
              const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
              view.setInt16(offset, sample * 0x7FFF, true);
              offset += 2;
            }
          }
          
          resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
        };
        
        wavRecorder(compressedBuffer);
      });
      
      audioContext.close();
      
      console.log('[AUDIO COMPRESSION] Original size:', audioBlob.size, 'Compressed size:', compressedBlob.size);
      return compressedBlob;
    } catch (error) {
      console.warn('[AUDIO COMPRESSION] Failed to compress, using original:', error);
      return audioBlob; // Return original if compression fails
    }
  };

  // Download recording with authentication
  const downloadRecording = async (recordingId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      console.log('[AUDIO DOWNLOAD] Downloading recording:', recordingId);
      
      const response = await fetch(`/api/recordings/${recordingId}/download`, {
        headers: {
          'x-user-id': token || '',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('[AUDIO DOWNLOAD] Download completed');
    } catch (error) {
      console.error('[AUDIO DOWNLOAD] Failed:', error);
      toast({
        title: 'Download Failed',
        description: `Failed to download recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      audioBlobs.forEach(blobUrl => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, []);

  // Cleanup blob URLs when component updates
  useEffect(() => {
    return () => {
      audioBlobs.forEach(blobUrl => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, [audioBlobs]);

  // Combine and sort timeline items
  const timelineItems = [
    ...remarks.map(r => ({ ...r, type: 'remark' as const })),
    ...recordings.map(r => ({ ...r, type: 'recording' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      {/* Add Remark Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Textarea
                placeholder="Add a remark..."
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Recording Controls */}
              {!recordedBlob ? (
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="gap-2"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop ({formatDuration(recordingDuration)})
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Record
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <FileAudio className="h-3 w-3" />
                    {formatDuration(recordingDuration)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRecordedBlob(null);
                      setRecordingDuration(0);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => recordedBlob && uploadRecordingMutation.mutate(recordedBlob)}
                    disabled={uploadRecordingMutation.isPending}
                  >
                    {uploadRecordingMutation.isPending ? 'Uploading...' : 'Upload Recording'}
                  </Button>
                </div>
              )}

              {/* File Upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="audio/*"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Audio
              </Button>
            </div>

            <Button
              onClick={() => newRemark.trim() && addRemarkMutation.mutate(newRemark)}
              disabled={!newRemark.trim() || addRemarkMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {addRemarkMutation.isPending ? 'Sending...' : 'Add Remark'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="space-y-3">
        {(remarksLoading || recordingsLoading) ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : timelineItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No remarks or recordings yet</p>
          </div>
        ) : (
          timelineItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    {item.type === 'remark' ? (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileAudio className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {item.type === 'remark' ? (item as Remark).userName : (item as Recording).uploadedByName}
                      </span>
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(item.type === 'remark' ? (item as Remark).userRole : 'user')}`}>
                        {item.type === 'remark' ? (item as Remark).userRole?.replace('_', ' ') : 'User'}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {item.type === 'remark' ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {(item as Remark).remarkText}
                      </p>
                    ) : (
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2 flex-1">
                          {loadingAudio.has(item.id) ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Loading audio...</span>
                            </div>
                          ) : audioBlobs.has(item.id) ? (
                            <audio
                              controls
                              className="h-8 flex-1"
                              src={audioBlobs.get(item.id)}
                              onPlay={() => handleAudioPlay(item.id)}
                              onPause={handleAudioPause}
                              onEnded={handleAudioPause}
                            />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadAudioFile(item.id)}
                              className="gap-2"
                            >
                              <Play className="h-4 w-4" />
                              Load Audio
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{(item as Recording).fileName}</span>
                          <span>({formatFileSize((item as Recording).fileSize)})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadRecording(item.id, (item as Recording).fileName)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
