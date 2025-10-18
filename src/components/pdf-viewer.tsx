"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { workerRequest } from "@/lib/worker";
import { motion, AnimatePresence } from "framer-motion";

type PDFViewerProps = {
  fileId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
};

export function PDFViewer({
  fileId,
  fileName,
  isOpen,
  onClose,
}: PDFViewerProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDownloadUrl = async () => {
    if (downloadUrl) return;

    setLoading(true);
    try {
      const data = await workerRequest<{ downloadUrl: string }>(
        `/api/files/${fileId}`
      );
      setDownloadUrl(data.downloadUrl);
    } catch (error) {
      console.error("Error loading PDF:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load download URL when dialog opens
  if (isOpen && !downloadUrl && !loading) {
    loadDownloadUrl();
  }

  return (
    <AnimatePresence>
      <Dialog open={isOpen} onOpenChange={onClose}>
        {isOpen && (
          <DialogContent className="max-w-[100vw] sm:max-w-[90vw] w-full h-[90vh] p-0 border-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full h-full"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center h-full"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"
                      />
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="text-sm text-muted-foreground"
                      >
                        Loading PDF...
                      </motion.p>
                    </motion.div>
                  </motion.div>
                ) : downloadUrl ? (
                  <motion.div
                    key="pdf"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <iframe
                      src={downloadUrl}
                      className="w-full h-full border-0 rounded-md"
                      title={fileName}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center h-full"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="text-center"
                    >
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="text-sm text-muted-foreground mb-4"
                      >
                        Failed to load PDF
                      </motion.p>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        <motion.button
                          onClick={loadDownloadUrl}
                          className="mt-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Retry
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </DialogContent>
        )}
      </Dialog>
    </AnimatePresence>
  );
}
