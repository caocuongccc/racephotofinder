'use client'

import { Facebook, Twitter, Link as LinkIcon, Mail } from 'lucide-react'
import { Button } from './ui/button'
import toast from 'react-hot-toast'

interface SocialShareProps {
  url: string
  title: string
  imageUrl?: string
}

export function SocialShare({ url, title, imageUrl }: SocialShareProps) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã copy link!')
    } catch (error) {
      toast.error('Không thể copy link')
    }
  }

  const openShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400')
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600 font-medium">Chia sẻ:</span>
      
      <Button
        size="sm"
        variant="outline"
        onClick={() => openShare('facebook')}
        className="flex items-center space-x-1"
      >
        <Facebook className="h-4 w-4 text-blue-600" />
        <span className="hidden sm:inline">Facebook</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => openShare('twitter')}
        className="flex items-center space-x-1"
      >
        <Twitter className="h-4 w-4 text-blue-400" />
        <span className="hidden sm:inline">Twitter</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => openShare('email')}
        className="flex items-center space-x-1"
      >
        <Mail className="h-4 w-4 text-gray-600" />
        <span className="hidden sm:inline">Email</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={copyToClipboard}
        className="flex items-center space-x-1"
      >
        <LinkIcon className="h-4 w-4 text-gray-600" />
        <span className="hidden sm:inline">Copy link</span>
      </Button>
    </div>
  )
}